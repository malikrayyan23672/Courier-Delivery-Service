import 'package:intl/intl.dart';

class Formatters {
  Formatters._();

  static final _currency = NumberFormat.currency(locale: 'en_PK', symbol: 'Rs. ', decimalDigits: 0);
  static final _time = DateFormat('h:mm a');
  static final _dateTime = DateFormat('d MMM, h:mm a');

  static String currency(num? value) => _currency.format(value ?? 0);
  static String time(DateTime? value) => value == null ? '--' : _time.format(value.toLocal());
  static String dateTime(DateTime? value) => value == null ? '--' : _dateTime.format(value.toLocal());

  /// Human status label for an order status enum value from the backend, e.g.
  /// "out_for_delivery" -> "Out For Delivery".
  static String statusLabel(String status) {
    return status
        .split('_')
        .map((word) => word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1)}')
        .join(' ');
  }
}
