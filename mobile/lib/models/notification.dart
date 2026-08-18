/// Mirrors backend/app/schemas/notification.py NotificationOut.
class AppNotification {
  final String id;
  final String title;
  final String type; // info | warning | error
  final String message;
  final bool isRead;
  final String? orderId;
  final DateTime createdAt;

  AppNotification({
    required this.id,
    required this.title,
    required this.type,
    required this.message,
    required this.isRead,
    this.orderId,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      title: json['title'] as String,
      type: json['type'] as String? ?? 'info',
      message: json['message'] as String,
      isRead: json['is_read'] as bool? ?? false,
      orderId: json['order_id'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
