/// Mirrors the plain-dict response of GET /rider/earnings.
class EarningsDay {
  final String date;
  final double earnings;
  final int deliveries;

  EarningsDay({required this.date, required this.earnings, required this.deliveries});

  factory EarningsDay.fromJson(Map<String, dynamic> json) {
    return EarningsDay(
      date: json['date'] as String,
      earnings: (json['earnings'] as num?)?.toDouble() ?? 0,
      deliveries: json['deliveries'] as int? ?? 0,
    );
  }
}

class EarningsBreakdown {
  final double totalEarnings;
  final int totalDeliveries;
  final List<EarningsDay> daily;

  EarningsBreakdown({required this.totalEarnings, required this.totalDeliveries, required this.daily});

  factory EarningsBreakdown.fromJson(Map<String, dynamic> json) {
    return EarningsBreakdown(
      totalEarnings: (json['total_earnings'] as num?)?.toDouble() ?? 0,
      totalDeliveries: json['total_deliveries'] as int? ?? 0,
      daily: (json['daily'] as List? ?? []).map((e) => EarningsDay.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
