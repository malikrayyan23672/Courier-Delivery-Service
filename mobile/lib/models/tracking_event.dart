class TrackingEvent {
  final String status;
  final String? note;
  final double? lat;
  final double? lng;
  final DateTime? createdAt;

  TrackingEvent({
    required this.status,
    this.note,
    this.lat,
    this.lng,
    this.createdAt,
  });

  factory TrackingEvent.fromJson(Map<String, dynamic> json) {
    return TrackingEvent(
      status: json['status'] as String? ?? '',
      note: json['note'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at'] as String) : null,
    );
  }
}
