class Payment {
  final double amount;
  final String method;
  final String status;
  final String? gatewayReference;

  Payment({
    required this.amount,
    required this.method,
    required this.status,
    this.gatewayReference,
  });

  bool get isCod => method.toLowerCase() == 'cash' || method.toLowerCase() == 'cod';

  factory Payment.fromJson(Map<String, dynamic> json) {
    return Payment(
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      method: json['method'] as String? ?? '',
      status: json['status'] as String? ?? '',
      gatewayReference: json['gateway_reference'] as String?,
    );
  }
}
