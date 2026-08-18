import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../models/notification.dart';
import '../../services/rider_service.dart';
import '../../services/rider_ws_service.dart';

class NotificationsProvider extends ChangeNotifier {
  NotificationsProvider(this._riderService, RiderWsService riderWsService) {
    load();
    _wsSubscription = riderWsService.events.listen((_) => load());
  }

  final RiderService _riderService;
  late final StreamSubscription _wsSubscription;

  List<AppNotification> notifications = [];
  bool isLoading = true;
  String? errorMessage;

  Future<void> load() async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();

    try {
      notifications = await _riderService.getNotifications();
    } catch (e) {
      errorMessage = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> markRead(String notificationId) async {
    final index = notifications.indexWhere((n) => n.id == notificationId);
    if (index == -1 || notifications[index].isRead) return;

    try {
      await _riderService.markNotificationRead(notificationId);
      final n = notifications[index];
      notifications[index] = AppNotification(
        id: n.id,
        title: n.title,
        type: n.type,
        message: n.message,
        isRead: true,
        orderId: n.orderId,
        createdAt: n.createdAt,
      );
      notifyListeners();
    } catch (_) {
      // Best-effort - if this fails the item just stays unread until next load().
    }
  }

  @override
  void dispose() {
    _wsSubscription.cancel();
    super.dispose();
  }
}
