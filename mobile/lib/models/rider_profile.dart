class RiderStats {
  final int deliveriesToday;
  final int activeDeliveries;
  final double earningsToday;

  RiderStats({
    required this.deliveriesToday,
    required this.activeDeliveries,
    required this.earningsToday,
  });

  factory RiderStats.fromJson(Map<String, dynamic> json) {
    return RiderStats(
      deliveriesToday: json['deliveries_today'] as int? ?? 0,
      activeDeliveries: json['active_deliveries'] as int? ?? 0,
      earningsToday: (json['earnings_today'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Mirrors backend/app/schemas/rider.py RiderMeOut - the single source of
/// truth for the dashboard.
class RiderProfile {
  final String fullName;
  final String? vehicleType;
  final String status;
  final bool isAvailable;
  final double rating;
  final RiderStats stats;
  final double codCashHeld;
  final bool codWalletLocked;
  final double codWalletLimit;
  final double codWalletWarningAt;

  RiderProfile({
    required this.fullName,
    this.vehicleType,
    required this.status,
    required this.isAvailable,
    required this.rating,
    required this.stats,
    required this.codCashHeld,
    required this.codWalletLocked,
    required this.codWalletLimit,
    required this.codWalletWarningAt,
  });

  double get codWalletFraction =>
      codWalletLimit <= 0 ? 0 : (codCashHeld / codWalletLimit).clamp(0, 1).toDouble();

  bool get codWalletNearLimit => codCashHeld >= codWalletWarningAt;

  factory RiderProfile.fromJson(Map<String, dynamic> json) {
    return RiderProfile(
      fullName: json['full_name'] as String? ?? '',
      vehicleType: json['vehicle_type'] as String?,
      status: json['status'] as String? ?? 'pending_verification',
      isAvailable: json['is_available'] as bool? ?? false,
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
      stats: RiderStats.fromJson(json['stats'] as Map<String, dynamic>),
      codCashHeld: (json['cod_cash_held'] as num?)?.toDouble() ?? 0,
      codWalletLocked: json['cod_wallet_locked'] as bool? ?? false,
      codWalletLimit: (json['cod_wallet_limit'] as num?)?.toDouble() ?? 0,
      codWalletWarningAt: (json['cod_wallet_warning_at'] as num?)?.toDouble() ?? 0,
    );
  }
}
