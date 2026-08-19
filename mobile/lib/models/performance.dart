/// Mirrors the plain-dict response of GET /rider/performance.
class PerformanceDay {
  final String date;
  final int delivered;
  final int failed;

  PerformanceDay({required this.date, required this.delivered, required this.failed});

  factory PerformanceDay.fromJson(Map<String, dynamic> json) {
    return PerformanceDay(
      date: json['date'] as String,
      delivered: json['delivered'] as int? ?? 0,
      failed: json['failed'] as int? ?? 0,
    );
  }
}

class Performance {
  final double rating;
  final int totalDelivered;
  final int totalFailed;
  final double successRate;
  final List<PerformanceDay> daily;

  Performance({
    required this.rating,
    required this.totalDelivered,
    required this.totalFailed,
    required this.successRate,
    required this.daily,
  });

  factory Performance.fromJson(Map<String, dynamic> json) {
    return Performance(
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
      totalDelivered: json['total_delivered'] as int? ?? 0,
      totalFailed: json['total_failed'] as int? ?? 0,
      successRate: (json['success_rate'] as num?)?.toDouble() ?? 0,
      daily: (json['daily'] as List? ?? []).map((e) => PerformanceDay.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
