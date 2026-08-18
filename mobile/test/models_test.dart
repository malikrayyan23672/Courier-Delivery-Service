import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/models/order.dart';
import 'package:rider_app/models/rider_profile.dart';

void main() {
  group('Order.fromJson', () {
    test('parses a list-style OrderOut payload (no payment/tracking_events)', () {
      final order = Order.fromJson({
        'id': 'order-1',
        'tracking_number': 'CR1234567890',
        'status': 'assigned',
        'booking_channel': 'online',
        'pickup_address': {'full_address': '12 Main St', 'city': 'Lahore'},
        'dropoff_address': {'full_address': '45 Mall Rd', 'city': 'Lahore'},
        'rider_accepted': null,
        'created_at': '2026-03-05T10:00:00Z',
      });

      expect(order.id, 'order-1');
      expect(order.status, OrderStatus.assigned);
      expect(order.pickupAddress?.fullAddress, '12 Main St');
      expect(order.trackingEvents, isEmpty);
      expect(order.payment, isNull);
      expect(order.codAmount, isNull);
    });

    test('a freshly-assigned, unaccepted order is a pending offer', () {
      final order = Order.fromJson({
        'id': 'order-2',
        'tracking_number': 'CR2',
        'status': 'assigned',
        'booking_channel': 'online',
        'rider_accepted': null,
      });
      expect(order.isPendingOffer, isTrue);
    });

    test('an accepted order is no longer a pending offer', () {
      final order = Order.fromJson({
        'id': 'order-3',
        'tracking_number': 'CR3',
        'status': 'assigned',
        'booking_channel': 'online',
        'rider_accepted': true,
      });
      expect(order.isPendingOffer, isFalse);
    });

    test('exposes codAmount only for a cash payment method', () {
      final cashOrder = Order.fromJson({
        'id': 'order-4',
        'tracking_number': 'CR4',
        'status': 'out_for_delivery',
        'booking_channel': 'online',
        'payment': {'amount': 3500, 'method': 'cash', 'status': 'pending'},
      });
      expect(cashOrder.codAmount, 3500);

      final prepaidOrder = Order.fromJson({
        'id': 'order-5',
        'tracking_number': 'CR5',
        'status': 'out_for_delivery',
        'booking_channel': 'online',
        'payment': {'amount': 3500, 'method': 'online_gateway', 'status': 'paid'},
      });
      expect(prepaidOrder.codAmount, isNull);
    });

    test('parses the tracking timeline on a detail payload', () {
      final order = Order.fromJson({
        'id': 'order-6',
        'tracking_number': 'CR6',
        'status': 'delivered',
        'booking_channel': 'online',
        'tracking_events': [
          {'status': 'picked_up', 'created_at': '2026-03-05T09:00:00Z'},
          {'status': 'delivered', 'note': 'Received by Ali', 'created_at': '2026-03-05T11:00:00Z'},
        ],
      });
      expect(order.trackingEvents, hasLength(2));
      expect(order.trackingEvents.last.note, 'Received by Ali');
    });
  });

  group('RiderProfile.fromJson', () {
    Map<String, dynamic> baseJson({double codCashHeld = 0, bool locked = false}) => {
          'full_name': 'Ali Raza',
          'vehicle_type': 'bike',
          'status': 'active',
          'is_available': true,
          'rating': 4.8,
          'stats': {'deliveries_today': 3, 'active_deliveries': 1, 'earnings_today': 450.0},
          'cod_cash_held': codCashHeld,
          'cod_wallet_locked': locked,
          'cod_wallet_limit': 30000.0,
          'cod_wallet_warning_at': 25000.0,
        };

    test('parses nested stats', () {
      final profile = RiderProfile.fromJson(baseJson());
      expect(profile.fullName, 'Ali Raza');
      expect(profile.stats.deliveriesToday, 3);
      expect(profile.stats.earningsToday, 450.0);
    });

    test('codWalletFraction is clamped between 0 and 1', () {
      final over = RiderProfile.fromJson(baseJson(codCashHeld: 45000));
      expect(over.codWalletFraction, 1.0);

      final empty = RiderProfile.fromJson(baseJson(codCashHeld: 0));
      expect(empty.codWalletFraction, 0.0);
    });

    test('codWalletNearLimit flips on once held cash crosses the warning threshold', () {
      final near = RiderProfile.fromJson(baseJson(codCashHeld: 26000));
      expect(near.codWalletNearLimit, isTrue);

      final safe = RiderProfile.fromJson(baseJson(codCashHeld: 1000));
      expect(safe.codWalletNearLimit, isFalse);
    });
  });
}
