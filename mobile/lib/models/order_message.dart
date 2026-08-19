/// Mirrors backend/app/schemas/order_message.py OrderMessageOut.
class OrderMessage {
  final String id;
  final String orderId;
  final String senderId;
  final String? senderName;
  final String? senderRole;
  final String body;
  final DateTime createdAt;

  OrderMessage({
    required this.id,
    required this.orderId,
    required this.senderId,
    this.senderName,
    this.senderRole,
    required this.body,
    required this.createdAt,
  });

  factory OrderMessage.fromJson(Map<String, dynamic> json) {
    return OrderMessage(
      id: json['id'] as String,
      orderId: json['order_id'] as String,
      senderId: json['sender_id'] as String,
      senderName: json['sender_name'] as String?,
      senderRole: json['sender_role'] as String?,
      body: json['body'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
