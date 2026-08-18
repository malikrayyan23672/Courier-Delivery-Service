import 'package:flutter/foundation.dart';

import '../../models/rider_profile.dart';
import '../../services/location_service.dart';
import '../../services/offline_queue_service.dart';
import '../../services/rider_service.dart';

class DashboardProvider extends ChangeNotifier {
  DashboardProvider(this._riderService, this._locationService, this._offlineQueueService) {
    load();
  }

  final RiderService _riderService;
  final LocationService _locationService;
  final OfflineQueueService _offlineQueueService;

  RiderProfile? profile;
  bool isLoading = true;
  bool isTogglingAvailability = false;
  String? errorMessage;

  /// Separate from [errorMessage] - that one drives AsyncStateView's
  /// full-page error state (used for the initial load), so an action-level
  /// failure (like a failed availability-change request) must not reuse it,
  /// or it would replace the entire dashboard - switch and all - with the
  /// error screen instead of just failing that one action.
  String? actionError;

  bool hasPendingRequest = false;
  bool? pendingRequestedValue;

  Future<void> load() async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();

    try {
      profile = await _riderService.getMe();
      if (profile!.isAvailable) {
        await _locationService.start();
      } else {
        _locationService.stop();
      }
      await _loadPendingState();
    } catch (e) {
      errorMessage = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _loadPendingState() async {
    final requests = await _riderService.getAvailabilityRequests();
    final pending = requests.where((r) => r.isPending).toList();
    hasPendingRequest = pending.isNotEmpty;
    pendingRequestedValue = pending.isNotEmpty ? pending.first.requestedIsAvailable : null;
  }

  /// Submits a request to change availability - is_available itself does not
  /// change until a staff/admin approver approves it. Call `load()` again
  /// (e.g. pull-to-refresh) to pick up the outcome once it's resolved. Falls
  /// back to the offline queue if there's no connectivity right now - the
  /// pending-request banner is shown optimistically either way since it
  /// reflects the rider's intent, and `load()` will reconcile it against the
  /// server once the request actually goes through.
  Future<void> requestAvailabilityChange(bool value) async {
    if (profile == null) return;
    isTogglingAvailability = true;
    actionError = null;
    notifyListeners();

    try {
      await _offlineQueueService.submitAvailabilityChange(value);
      hasPendingRequest = true;
      pendingRequestedValue = value;
    } catch (e) {
      actionError = e.toString();
    } finally {
      isTogglingAvailability = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _locationService.dispose();
    super.dispose();
  }
}
