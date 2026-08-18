/// Mirrors backend/app/schemas/bus_network.py ManifestItemOut.
class ManifestItem {
  final String id;
  final String? orderId;
  final String? crateLabel;
  final String? scanStatus;
  final DateTime? scannedAt;
  final String? trackingNumber;

  ManifestItem({
    required this.id,
    this.orderId,
    this.crateLabel,
    this.scanStatus,
    this.scannedAt,
    this.trackingNumber,
  });

  factory ManifestItem.fromJson(Map<String, dynamic> json) {
    return ManifestItem(
      id: json['id'] as String,
      orderId: json['order_id'] as String?,
      crateLabel: json['crate_label'] as String?,
      scanStatus: json['scan_status'] as String?,
      scannedAt: json['scanned_at'] != null ? DateTime.tryParse(json['scanned_at'] as String) : null,
      trackingNumber: json['tracking_number'] as String?,
    );
  }
}
