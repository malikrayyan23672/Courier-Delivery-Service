/// One lock/unlock/limit-change event on the rider's COD cash-in-hand
/// wallet (see backend rider.py's `GET /rider/wallet/history`, which reads
/// the same audit log rows settlement_service.py writes on every wallet
/// action).
class WalletHistoryEntry {
  final String id;
  final String action;
  final String? details;
  final DateTime? createdAt;

  WalletHistoryEntry({
    required this.id,
    required this.action,
    this.details,
    this.createdAt,
  });

  factory WalletHistoryEntry.fromJson(Map<String, dynamic> json) {
    return WalletHistoryEntry(
      id: json['id'] as String,
      action: json['action'] as String,
      details: json['details'] as String?,
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at'] as String) : null,
    );
  }
}
