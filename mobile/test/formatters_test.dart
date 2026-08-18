import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/core/utils/formatters.dart';

void main() {
  group('Formatters.currency', () {
    test('formats a positive amount with the Rs. prefix and no decimals', () {
      expect(Formatters.currency(3500), 'Rs. 3,500');
    });

    test('treats null as zero', () {
      expect(Formatters.currency(null), 'Rs. 0');
    });
  });

  group('Formatters.statusLabel', () {
    test('title-cases each underscore-separated word', () {
      expect(Formatters.statusLabel('out_for_delivery'), 'Out For Delivery');
    });

    test('handles a single-word status', () {
      expect(Formatters.statusLabel('delivered'), 'Delivered');
    });
  });

  group('Formatters.time / dateTime', () {
    test('returns a placeholder for null', () {
      expect(Formatters.time(null), '--');
      expect(Formatters.dateTime(null), '--');
    });

    test('formats a real DateTime without throwing', () {
      final value = DateTime(2026, 3, 5, 14, 30);
      expect(Formatters.time(value), isNotEmpty);
      expect(Formatters.dateTime(value), isNotEmpty);
    });
  });
}
