import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/network/api_exception.dart';
import '../models/support_ticket.dart';
import 'rider_service.dart';

/// Every write a rider makes on shift, in the order it can show up while
/// working a dead zone: closing out a parcel (status update / full proof of
/// delivery), toggling availability, asking to be released from a parcel,
/// and support tickets. Kept as a flat enum + JSON payload (rather than one
/// class per action) so the whole queue can be persisted with one
/// encode/decode path.
enum QueuedActionType {
  deliveryStatusUpdate,
  proofOfDelivery,
  deliveryFailed,
  availabilityChange,
  supportTicketCreate,
  supportTicketReply,
  parcelUnlockRequest,
}

class QueuedAction {
  final String id;
  final QueuedActionType type;
  final Map<String, dynamic> payload;
  final DateTime capturedAt;

  QueuedAction({
    required this.id,
    required this.type,
    required this.payload,
    required this.capturedAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'payload': payload,
        'capturedAt': capturedAt.toIso8601String(),
      };

  factory QueuedAction.fromJson(Map<String, dynamic> json) => QueuedAction(
        id: json['id'] as String,
        type: QueuedActionType.values.byName(json['type'] as String),
        payload: Map<String, dynamic>.from(json['payload'] as Map),
        capturedAt: DateTime.parse(json['capturedAt'] as String),
      );

  static const _labels = {
    QueuedActionType.deliveryStatusUpdate: 'Delivery status update',
    QueuedActionType.proofOfDelivery: 'Proof of delivery',
    QueuedActionType.deliveryFailed: 'Failed delivery report',
    QueuedActionType.availabilityChange: 'Availability change request',
    QueuedActionType.supportTicketCreate: 'Support ticket',
    QueuedActionType.supportTicketReply: 'Support ticket reply',
    QueuedActionType.parcelUnlockRequest: 'Unlock request',
  };

  String get label => _labels[type]!;
}

enum QueuedActionOutcome { sent, queued }

/// Local-first action queue + sync engine for the rider app. Every write in
/// [RiderService] that a rider needs mid-shift (closing out a parcel,
/// toggling availability, filing/replying to a support ticket, asking to be
/// released from a parcel) goes through here first: try the API call, and
/// only fall back to the local queue if the request never reached the server
/// at all (no connectivity), not if the server answered and rejected it.
///
/// Two independent triggers flush the queue: a `connectivity_plus` listener
/// (fires the instant the OS reports the network is back) and a 30-second
/// [Timer.periodic] "sync engine" (retries even when no connectivity-change
/// event fires - e.g. flaky signal that never fully drops, or a transient
/// server-side failure rather than a connectivity gap). The queue itself is
/// persisted to `shared_preferences` on every mutation, so it survives app
/// restarts/kills across an entire offline shift.
class OfflineQueueService extends ChangeNotifier {
  OfflineQueueService(this._riderService) {
    _restore();
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((results) {
      final online = !results.contains(ConnectivityResult.none);
      if (online) flush();
    });
    _syncTimer = Timer.periodic(const Duration(seconds: 30), (_) => flush());
  }

  static const _prefsKey = 'pending_actions';

  final RiderService _riderService;
  late final StreamSubscription<List<ConnectivityResult>> _connectivitySubscription;
  late final Timer _syncTimer;
  int _idCounter = 0;

  final List<QueuedAction> pending = [];

  /// Human-readable messages for queued actions the server permanently
  /// rejected once back online (e.g. an OTP that expired while the phone was
  /// offline) - these are dropped from [pending] rather than retried
  /// forever, so this is the only way the rider finds out an action never
  /// actually went through. The UI is expected to show these and call
  /// [clearDroppedMessages] once acknowledged.
  final List<String> droppedMessages = [];

  bool _isFlushing = false;

  String _newId() => '${DateTime.now().microsecondsSinceEpoch}-${_idCounter++}';

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_prefsKey) ?? [];
    pending.addAll(raw.map((s) => QueuedAction.fromJson(jsonDecode(s) as Map<String, dynamic>)));
    notifyListeners();
    if (pending.isNotEmpty) flush();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_prefsKey, pending.map((p) => jsonEncode(p.toJson())).toList());
  }

  /// Copies a captured photo out of image_picker's cache (which the OS can
  /// reclaim at any time) into a durable app-support directory, so it
  /// survives sitting in the queue for hours before the rider gets signal.
  Future<String> _copyToDurableStorage(File photo, String orderId, {String subfolder = 'pending_pod', String prefix = 'pod'}) async {
    final dir = await getApplicationSupportDirectory();
    final destDir = Directory('${dir.path}/$subfolder');
    if (!await destDir.exists()) await destDir.create(recursive: true);
    final dest = File('${destDir.path}/${prefix}_${orderId}_${DateTime.now().microsecondsSinceEpoch}.jpg');
    await photo.copy(dest.path);
    return dest.path;
  }

  /// Tries [send] immediately; if it fails purely because there's no
  /// connectivity (no statusCode - Dio never got a response), queues
  /// [type]/[payload] and returns [QueuedActionOutcome.queued] instead of
  /// throwing. A statusCode means the server answered and rejected the
  /// request, which retrying later won't fix, so that's surfaced as an error
  /// instead.
  Future<QueuedActionOutcome> _submitOrQueue({
    required QueuedActionType type,
    required Map<String, dynamic> payload,
    required Future<void> Function() send,
  }) async {
    try {
      await send();
      return QueuedActionOutcome.sent;
    } on ApiException catch (e) {
      if (e.statusCode == null) {
        pending.add(QueuedAction(id: _newId(), type: type, payload: payload, capturedAt: DateTime.now()));
        await _persist();
        notifyListeners();
        return QueuedActionOutcome.queued;
      }
      rethrow;
    }
  }

  Future<QueuedActionOutcome> submitStatusUpdate({
    required String orderId,
    required String newStatus,
    String? note,
    double? lat,
    double? lng,
  }) {
    return _submitOrQueue(
      type: QueuedActionType.deliveryStatusUpdate,
      payload: {'orderId': orderId, 'newStatus': newStatus, 'note': note, 'lat': lat, 'lng': lng},
      send: () async {
        await _riderService.updateDeliveryStatus(orderId, newStatus: newStatus, note: note, lat: lat, lng: lng);
      },
    );
  }

  /// Closes out a parcel with OTP + photo + GPS. If it can't reach the
  /// server, the photo is copied to durable storage before queuing (the
  /// original picker path is not safe to hold onto for hours) and everything
  /// else the rider already captured client-side (a 6-digit OTP and a GPS
  /// fix) travels with it - the server independently re-verifies the OTP
  /// once synced, so queuing this does not weaken the OTP+photo+GPS rule.
  Future<QueuedActionOutcome> submitProofOfDelivery({
    required String orderId,
    required File photo,
    required String otpCode,
    required double lat,
    required double lng,
    String? recipientName,
    String? note,
  }) async {
    try {
      await _riderService.submitProofOfDelivery(
        orderId,
        photo: photo,
        otpCode: otpCode,
        lat: lat,
        lng: lng,
        recipientName: recipientName,
        note: note,
      );
      return QueuedActionOutcome.sent;
    } on ApiException catch (e) {
      if (e.statusCode == null) {
        final durablePath = await _copyToDurableStorage(photo, orderId);
        pending.add(QueuedAction(
          id: _newId(),
          type: QueuedActionType.proofOfDelivery,
          payload: {
            'orderId': orderId,
            'photoPath': durablePath,
            'otpCode': otpCode,
            'lat': lat,
            'lng': lng,
            'recipientName': recipientName,
            'note': note,
          },
          capturedAt: DateTime.now(),
        ));
        await _persist();
        notifyListeners();
        return QueuedActionOutcome.queued;
      }
      rethrow;
    }
  }

  /// Reports a failed delivery attempt. [photo] is only present on the 3rd
  /// (final) attempt - when it is, this follows [submitProofOfDelivery]'s
  /// durable-copy pattern so it still queues offline; without a photo it's
  /// plain JSON like [submitStatusUpdate].
  Future<QueuedActionOutcome> submitDeliveryFailed({
    required String orderId,
    required String note,
    required String reason,
    double? lat,
    double? lng,
    File? photo,
  }) async {
    if (photo == null) {
      return _submitOrQueue(
        type: QueuedActionType.deliveryFailed,
        payload: {'orderId': orderId, 'note': note, 'reason': reason, 'lat': lat, 'lng': lng},
        send: () async {
          await _riderService.reportDeliveryFailed(orderId, note: note, reason: reason, lat: lat, lng: lng);
        },
      );
    }

    try {
      await _riderService.reportDeliveryFailed(orderId, note: note, reason: reason, lat: lat, lng: lng, photo: photo);
      return QueuedActionOutcome.sent;
    } on ApiException catch (e) {
      if (e.statusCode == null) {
        final durablePath = await _copyToDurableStorage(photo, orderId, subfolder: 'pending_failure', prefix: 'failure');
        pending.add(QueuedAction(
          id: _newId(),
          type: QueuedActionType.deliveryFailed,
          payload: {'orderId': orderId, 'note': note, 'reason': reason, 'lat': lat, 'lng': lng, 'photoPath': durablePath},
          capturedAt: DateTime.now(),
        ));
        await _persist();
        notifyListeners();
        return QueuedActionOutcome.queued;
      }
      rethrow;
    }
  }

  Future<QueuedActionOutcome> submitAvailabilityChange(bool isAvailable, {String? note}) {
    return _submitOrQueue(
      type: QueuedActionType.availabilityChange,
      payload: {'isAvailable': isAvailable, 'note': note},
      send: () async {
        await _riderService.requestAvailabilityChange(isAvailable, note: note);
      },
    );
  }

  /// Unlike the other `submit*` methods, this one needs the created
  /// [SupportTicket] back (its id) so the caller can navigate straight to the
  /// ticket thread on immediate success - so it can't go through the generic
  /// [_submitOrQueue], which discards the send() result.
  Future<(QueuedActionOutcome, SupportTicket?)> submitSupportTicketCreate({
    required String subject,
    required String message,
    String? orderId,
  }) async {
    try {
      final ticket = await _riderService.createSupportTicket(subject: subject, message: message, orderId: orderId);
      return (QueuedActionOutcome.sent, ticket);
    } on ApiException catch (e) {
      if (e.statusCode == null) {
        pending.add(QueuedAction(
          id: _newId(),
          type: QueuedActionType.supportTicketCreate,
          payload: {'subject': subject, 'message': message, 'orderId': orderId},
          capturedAt: DateTime.now(),
        ));
        await _persist();
        notifyListeners();
        return (QueuedActionOutcome.queued, null);
      }
      rethrow;
    }
  }

  Future<QueuedActionOutcome> submitSupportTicketReply({required String ticketId, required String body}) {
    return _submitOrQueue(
      type: QueuedActionType.supportTicketReply,
      payload: {'ticketId': ticketId, 'body': body},
      send: () async {
        await _riderService.replyToSupportTicket(ticketId, body);
      },
    );
  }

  Future<QueuedActionOutcome> submitParcelUnlockRequest(String orderId, {String? reason}) {
    return _submitOrQueue(
      type: QueuedActionType.parcelUnlockRequest,
      payload: {'orderId': orderId, 'reason': reason},
      send: () async {
        await _riderService.requestParcelUnlock(orderId, reason: reason);
      },
    );
  }

  Future<void> _dispatch(QueuedAction action) async {
    final p = action.payload;
    switch (action.type) {
      case QueuedActionType.deliveryStatusUpdate:
        await _riderService.updateDeliveryStatus(
          p['orderId'] as String,
          newStatus: p['newStatus'] as String,
          note: p['note'] as String?,
          lat: (p['lat'] as num?)?.toDouble(),
          lng: (p['lng'] as num?)?.toDouble(),
        );
        return;
      case QueuedActionType.proofOfDelivery:
        final photo = File(p['photoPath'] as String);
        if (!await photo.exists()) {
          // The OS reclaimed the durable copy too - nothing left to retry with.
          throw ApiException('The captured delivery photo is no longer available on this device', statusCode: 0);
        }
        await _riderService.submitProofOfDelivery(
          p['orderId'] as String,
          photo: photo,
          otpCode: p['otpCode'] as String,
          lat: (p['lat'] as num).toDouble(),
          lng: (p['lng'] as num).toDouble(),
          recipientName: p['recipientName'] as String?,
          note: p['note'] as String?,
        );
        unawaited(photo.delete().catchError((_) => photo));
        return;
      case QueuedActionType.deliveryFailed:
        final photoPath = p['photoPath'] as String?;
        File? photo;
        if (photoPath != null) {
          photo = File(photoPath);
          if (!await photo.exists()) {
            throw ApiException('The captured failure photo is no longer available on this device', statusCode: 0);
          }
        }
        await _riderService.reportDeliveryFailed(
          p['orderId'] as String,
          note: p['note'] as String,
          // Falls back to 'other' for actions queued before `reason` existed.
          reason: (p['reason'] as String?) ?? 'other',
          lat: (p['lat'] as num?)?.toDouble(),
          lng: (p['lng'] as num?)?.toDouble(),
          photo: photo,
        );
        if (photo != null) unawaited(photo.delete().catchError((_) => photo!));
        return;
      case QueuedActionType.availabilityChange:
        await _riderService.requestAvailabilityChange(p['isAvailable'] as bool, note: p['note'] as String?);
        return;
      case QueuedActionType.supportTicketCreate:
        await _riderService.createSupportTicket(
          subject: p['subject'] as String,
          message: p['message'] as String,
          orderId: p['orderId'] as String?,
        );
        return;
      case QueuedActionType.supportTicketReply:
        await _riderService.replyToSupportTicket(p['ticketId'] as String, p['body'] as String);
        return;
      case QueuedActionType.parcelUnlockRequest:
        await _riderService.requestParcelUnlock(p['orderId'] as String, reason: p['reason'] as String?);
        return;
    }
  }

  String _describeDropped(QueuedAction action, ApiException e) {
    final orderId = action.payload['orderId'] as String?;
    final suffix = orderId != null ? ' ($orderId)' : '';
    return '${action.label}$suffix failed to sync: ${e.message}';
  }

  Future<void> flush() async {
    if (_isFlushing || pending.isEmpty) return;
    _isFlushing = true;

    while (pending.isNotEmpty) {
      final next = pending.first;
      try {
        await _dispatch(next);
        pending.removeAt(0);
        await _persist();
        notifyListeners();
      } on ApiException catch (e) {
        if (e.statusCode == null) {
          // Still offline - stop draining and leave the rest queued for the next attempt.
          break;
        }
        // The server answered and rejected it (e.g. the order moved on, or an
        // OTP expired while offline) - retrying won't help, so drop it rather
        // than blocking the rest of the queue forever, but tell the rider.
        debugPrint('Dropping queued action ${next.id} (${next.type.name}): ${e.message}');
        droppedMessages.add(_describeDropped(next, e));
        pending.removeAt(0);
        await _persist();
        notifyListeners();
      }
    }

    _isFlushing = false;
  }

  void clearDroppedMessages() {
    droppedMessages.clear();
    notifyListeners();
  }

  @override
  void dispose() {
    _connectivitySubscription.cancel();
    _syncTimer.cancel();
    super.dispose();
  }
}
