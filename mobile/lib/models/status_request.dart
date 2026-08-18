/// Mirrors backend/app/schemas/rider_status_request.py RiderStatusRequestOut.
class StatusRequest {
  final String id;
  final String riderId;
  final String? riderName;
  final String requestedById;
  final bool requestedIsAvailable;
  final String? note;
  final String status; // pending | approved | rejected
  final String? resolutionNote;
  final DateTime? resolvedAt;
  final DateTime? createdAt;

  StatusRequest({
    required this.id,
    required this.riderId,
    this.riderName,
    required this.requestedById,
    required this.requestedIsAvailable,
    this.note,
    required this.status,
    this.resolutionNote,
    this.resolvedAt,
    this.createdAt,
  });

  bool get isPending => status == 'pending';

  factory StatusRequest.fromJson(Map<String, dynamic> json) {
    return StatusRequest(
      id: json['id'] as String,
      riderId: json['rider_id'] as String,
      riderName: json['rider_name'] as String?,
      requestedById: json['requested_by_id'] as String,
      requestedIsAvailable: json['requested_is_available'] as bool,
      note: json['note'] as String?,
      status: json['status'] as String? ?? 'pending',
      resolutionNote: json['resolution_note'] as String?,
      resolvedAt: json['resolved_at'] != null ? DateTime.tryParse(json['resolved_at'] as String) : null,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null,
    );
  }
}
