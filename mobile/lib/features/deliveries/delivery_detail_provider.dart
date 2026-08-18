import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../../models/order.dart';
import '../../services/location_service.dart';
import '../../services/offline_queue_service.dart';
import '../../services/rider_service.dart';

enum ActionResult { success, queued, failed }

class DeliveryDetailProvider extends ChangeNotifier {
  DeliveryDetailProvider(
    this._riderService,
    this._locationService,
    this._offlineQueueService,
    this.orderId,
  ) {
    load();
  }

  final RiderService _riderService;
  final LocationService _locationService;
  final OfflineQueueService _offlineQueueService;
  final String orderId;

  Order? order;
  bool isLoading = true;
  bool isActing = false;
  String? errorMessage;
  String? actionError;
  bool hasPendingUnlockRequest = false;

  /// True when [actionError] is a location-permission denial the rider fixed
  /// by opening Settings - lets the screen offer that shortcut instead of a
  /// dead-end error message.
  bool actionErrorNeedsLocationSettings = false;

  Future<void> load() async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();

    try {
      order = await _riderService.getDeliveryDetail(orderId);
      if (order!.status == OrderStatus.assigned && order!.riderAccepted == true) {
        final unlockRequests = await _riderService.getUnlockRequests(orderId);
        hasPendingUnlockRequest = unlockRequests.any((r) => r.isPending);
      } else {
        hasPendingUnlockRequest = false;
      }
    } catch (e) {
      errorMessage = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  /// Requests to be released from this already-accepted delivery. Needs
  /// staff/admin approval - order.rider_id doesn't change until then.
  Future<bool> requestUnlock({String? reason}) {
    return _runAction(() => _riderService.requestParcelUnlock(orderId, reason: reason));
  }

  Future<bool> _runAction(Future<void> Function() action) async {
    isActing = true;
    actionError = null;
    actionErrorNeedsLocationSettings = false;
    notifyListeners();

    try {
      await action();
      await load();
      return true;
    } catch (e) {
      actionError = e.toString();
      isActing = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> respondToOffer({required bool accept}) {
    return _runAction(() => _riderService.respondToOffer(orderId, accept: accept));
  }

  Future<ActionResult> _submitStatusUpdate({
    required String newStatus,
    String? note,
    double? lat,
    double? lng,
  }) async {
    isActing = true;
    actionError = null;
    actionErrorNeedsLocationSettings = false;
    notifyListeners();

    try {
      final outcome = await _offlineQueueService.submitStatusUpdate(
        orderId: orderId,
        newStatus: newStatus,
        note: note,
        lat: lat,
        lng: lng,
      );
      if (outcome == StatusUpdateOutcome.sent) {
        await load();
        return ActionResult.success;
      } else {
        isActing = false;
        notifyListeners();
        return ActionResult.queued;
      }
    } catch (e) {
      actionError = e.toString();
      isActing = false;
      notifyListeners();
      return ActionResult.failed;
    }
  }

  /// Confirms pickup for the currently-unlocked parcel - requires GPS, per spec section 20.
  /// Falls back to the offline queue if there's no connectivity right now.
  Future<ActionResult> confirmPickup() async {
    isActing = true;
    actionError = null;
    actionErrorNeedsLocationSettings = false;
    notifyListeners();

    final Position position;
    try {
      position = await _locationService.getCurrentPosition();
    } on LocationPermissionException catch (e) {
      actionError = e.message;
      actionErrorNeedsLocationSettings = e.isPermanentlyDenied;
      isActing = false;
      notifyListeners();
      return ActionResult.failed;
    } catch (e) {
      actionError = e.toString();
      isActing = false;
      notifyListeners();
      return ActionResult.failed;
    }

    return _submitStatusUpdate(
      newStatus: OrderStatus.pickedUp,
      lat: position.latitude,
      lng: position.longitude,
    );
  }

  /// GPS is best-effort here (not strictly required to report a failed
  /// delivery attempt) - if it can't be resolved, submits without coordinates
  /// rather than blocking the rider from recording the failure at all.
  Future<ActionResult> markFailed({required String reason}) async {
    Position? position;
    try {
      position = await _locationService.getCurrentPosition();
    } catch (_) {
      position = null;
    }
    return _submitStatusUpdate(
      newStatus: OrderStatus.failed,
      note: reason,
      lat: position?.latitude,
      lng: position?.longitude,
    );
  }

  Future<void> openLocationSettings() => _locationService.openLocationSettings();

  Future<bool> sendDeliveryOtp() {
    return _runAction(() => _riderService.sendDeliveryOtp(orderId));
  }
}
