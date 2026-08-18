/// Mirrors backend/app/schemas/parcel_unlock_request.py ParcelUnlockRequestOut.
class ParcelUnlockRequest {
  final String id;
  final String orderId;
  final String? trackingNumber;
  final String riderId;
  final String? riderName;
  final String requestedById;
  final String? reason;
  final String status; // pending | approved | rejected
  final String? resolutionNote;
  final DateTime? resolvedAt;
  final DateTime? createdAt;

  ParcelUnlockRequest({
    required this.id,
    required this.orderId,
    this.trackingNumber,
    required this.riderId,
    this.riderName,
    required this.requestedById,
    this.reason,
    required this.status,
    this.resolutionNote,
    this.resolvedAt,
    this.createdAt,
  });

  bool get isPending => status == 'pending';

  factory ParcelUnlockRequest.fromJson(Map<String, dynamic> json) {
    return ParcelUnlockRequest(
      id: json['id'] as String,
      orderId: json['order_id'] as String,
      trackingNumber: json['tracking_number'] as String?,
      riderId: json['rider_id'] as String,
      riderName: json['rider_name'] as String?,
      requestedById: json['requested_by_id'] as String,
      reason: json['reason'] as String?,
      status: json['status'] as String? ?? 'pending',
      resolutionNote: json['resolution_note'] as String?,
      resolvedAt: json['resolved_at'] != null ? DateTime.tryParse(json['resolved_at'] as String) : null,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null,
    );
  }
}
