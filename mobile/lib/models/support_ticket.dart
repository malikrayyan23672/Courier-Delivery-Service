/// Mirrors backend/app/schemas/support_ticket.py SupportTicketMessageOut.
class SupportTicketMessage {
  final String id;
  final String senderId;
  final String? senderName;
  final String body;
  final DateTime? createdAt;

  SupportTicketMessage({
    required this.id,
    required this.senderId,
    this.senderName,
    required this.body,
    this.createdAt,
  });

  factory SupportTicketMessage.fromJson(Map<String, dynamic> json) {
    return SupportTicketMessage(
      id: json['id'] as String,
      senderId: json['sender_id'] as String,
      senderName: json['sender_name'] as String?,
      body: json['body'] as String,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null,
    );
  }
}

/// Mirrors backend/app/schemas/support_ticket.py SupportTicketOut.
class SupportTicket {
  final String id;
  final String raisedById;
  final String? raisedByName;
  final String subject;
  final String? orderId;
  final String? trackingNumber;
  final String status; // open | in_progress | resolved | closed
  final DateTime? resolvedAt;
  final DateTime? createdAt;
  final List<SupportTicketMessage> messages;

  SupportTicket({
    required this.id,
    required this.raisedById,
    this.raisedByName,
    required this.subject,
    this.orderId,
    this.trackingNumber,
    required this.status,
    this.resolvedAt,
    this.createdAt,
    this.messages = const [],
  });

  bool get isOpen => status == 'open' || status == 'in_progress';

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    return SupportTicket(
      id: json['id'] as String,
      raisedById: json['raised_by_id'] as String,
      raisedByName: json['raised_by_name'] as String?,
      subject: json['subject'] as String,
      orderId: json['order_id'] as String?,
      trackingNumber: json['tracking_number'] as String?,
      status: json['status'] as String? ?? 'open',
      resolvedAt: json['resolved_at'] != null ? DateTime.tryParse(json['resolved_at'] as String) : null,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null,
      messages: json['messages'] != null
          ? (json['messages'] as List).map((e) => SupportTicketMessage.fromJson(e as Map<String, dynamic>)).toList()
          : const [],
    );
  }
}
