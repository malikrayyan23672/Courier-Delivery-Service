import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/network/api_exception.dart';
import 'rider_service.dart';

/// A single queued delivery-status change (picked_up / failed) captured while
/// offline. Deliberately narrow in scope: this is a lite precursor to the full
/// offline-first event queue + conflict-logging engine described in the spec
/// (sections 40-46) - it covers the one write the rider is most likely to need
/// in a dead zone (closing out the parcel in front of them), persisted across
/// app restarts, not a generic local mirror of every entity with conflict
/// resolution.
class PendingStatusUpdate {
  final String orderId;
  final String newStatus;
  final String? note;
  final double? lat;
  final double? lng;
  final DateTime capturedAt;

  PendingStatusUpdate({
    required this.orderId,
    required this.newStatus,
    this.note,
    this.lat,
    this.lng,
    required this.capturedAt,
  });

  Map<String, dynamic> toJson() => {
        'orderId': orderId,
        'newStatus': newStatus,
        'note': note,
        'lat': lat,
        'lng': lng,
        'capturedAt': capturedAt.toIso8601String(),
      };

  factory PendingStatusUpdate.fromJson(Map<String, dynamic> json) => PendingStatusUpdate(
        orderId: json['orderId'] as String,
        newStatus: json['newStatus'] as String,
        note: json['note'] as String?,
        lat: (json['lat'] as num?)?.toDouble(),
        lng: (json['lng'] as num?)?.toDouble(),
        capturedAt: DateTime.parse(json['capturedAt'] as String),
      );
}

enum StatusUpdateOutcome { sent, queued }

class OfflineQueueService extends ChangeNotifier {
  OfflineQueueService(this._riderService) {
    _restore();
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((results) {
      final online = !results.contains(ConnectivityResult.none);
      if (online) flush();
    });
  }

  static const _prefsKey = 'pending_status_updates';

  final RiderService _riderService;
  late final StreamSubscription<List<ConnectivityResult>> _connectivitySubscription;
  final List<PendingStatusUpdate> pending = [];
  bool _isFlushing = false;

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_prefsKey) ?? [];
    pending.addAll(raw.map((s) => PendingStatusUpdate.fromJson(jsonDecode(s) as Map<String, dynamic>)));
    notifyListeners();
    if (pending.isNotEmpty) flush();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_prefsKey, pending.map((p) => jsonEncode(p.toJson())).toList());
  }

  /// Tries the status update immediately; if it fails because there's no
  /// connectivity, queues it and returns [StatusUpdateOutcome.queued] instead
  /// of throwing, so the caller can show "queued, will sync" rather than an error.
  Future<StatusUpdateOutcome> submitStatusUpdate({
    required String orderId,
    required String newStatus,
    String? note,
    double? lat,
    double? lng,
  }) async {
    try {
      await _riderService.updateDeliveryStatus(orderId, newStatus: newStatus, note: note, lat: lat, lng: lng);
      return StatusUpdateOutcome.sent;
    } on ApiException catch (e) {
      // No statusCode means Dio never got a response at all (timeout / no route to
      // host) - that's "offline", worth queuing. A statusCode means the server
      // answered (e.g. 400/404) and retrying later won't help, so surface it instead.
      if (e.statusCode == null) {
        pending.add(PendingStatusUpdate(
          orderId: orderId,
          newStatus: newStatus,
          note: note,
          lat: lat,
          lng: lng,
          capturedAt: DateTime.now(),
        ));
        await _persist();
        notifyListeners();
        return StatusUpdateOutcome.queued;
      }
      rethrow;
    }
  }

  Future<void> flush() async {
    if (_isFlushing || pending.isEmpty) return;
    _isFlushing = true;

    while (pending.isNotEmpty) {
      final next = pending.first;
      try {
        await _riderService.updateDeliveryStatus(
          next.orderId,
          newStatus: next.newStatus,
          note: next.note,
          lat: next.lat,
          lng: next.lng,
        );
        pending.removeAt(0);
        await _persist();
        notifyListeners();
      } on ApiException catch (e) {
        if (e.statusCode == null) {
          // Still offline - stop draining and leave the rest queued for the next attempt.
          break;
        }
        // The server responded and rejected it (e.g. the order moved on in the
        // meantime) - retrying won't help, so drop it rather than blocking the
        // rest of the queue forever.
        debugPrint('Dropping queued status update for ${next.orderId}: ${e.message}');
        pending.removeAt(0);
        await _persist();
        notifyListeners();
      }
    }

    _isFlushing = false;
  }

  @override
  void dispose() {
    _connectivitySubscription.cancel();
    super.dispose();
  }
}
