import 'package:flutter/foundation.dart';

import '../../models/order.dart';
import '../../services/rider_service.dart';

class DeliveriesProvider extends ChangeNotifier {
  DeliveriesProvider(this._riderService) {
    load();
  }

  final RiderService _riderService;

  List<Order> orders = [];
  bool isLoading = true;
  String? errorMessage;

  List<Order> get pendingOffers => orders.where((o) => o.isPendingOffer).toList();

  List<Order> get active => orders
      .where((o) => !o.isPendingOffer && OrderStatus.active.contains(o.status))
      .toList();

  List<Order> get history => orders
      .where((o) => [OrderStatus.delivered, OrderStatus.failed, OrderStatus.rto, OrderStatus.cancelled]
          .contains(o.status))
      .toList();

  Future<void> load() async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();

    try {
      orders = await _riderService.getDeliveries();
    } catch (e) {
      errorMessage = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }
}
