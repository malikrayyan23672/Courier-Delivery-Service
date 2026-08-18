import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_state_view.dart';
import '../../models/support_ticket.dart';
import '../../services/rider_service.dart';

class TicketDetailScreen extends StatefulWidget {
  final String ticketId;

  const TicketDetailScreen({super.key, required this.ticketId});

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  final _riderService = RiderService();
  final _replyController = TextEditingController();

  SupportTicket? _ticket;
  bool _isLoading = true;
  String? _errorMessage;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final ticket = await _riderService.getSupportTicketDetail(widget.ticketId);
      setState(() => _ticket = ticket);
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _sendReply() async {
    final body = _replyController.text.trim();
    if (body.isEmpty) return;
    setState(() => _sending = true);
    try {
      final ticket = await _riderService.replyToSupportTicket(widget.ticketId, body);
      _replyController.clear();
      setState(() => _ticket = ticket);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_ticket?.subject ?? 'Ticket')),
      body: AsyncStateView(
        isLoading: _isLoading,
        errorMessage: _errorMessage,
        onRetry: _load,
        builder: (context) {
          final ticket = _ticket!;
          return Column(
            children: [
              Container(
                width: double.infinity,
                color: ticket.isOpen ? AppColors.warning.withValues(alpha: 0.12) : AppColors.success.withValues(alpha: 0.12),
                padding: const EdgeInsets.all(10),
                child: Text(
                  ticket.status[0].toUpperCase() + ticket.status.substring(1).replaceAll('_', ' '),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: ticket.isOpen ? AppColors.warning : AppColors.success,
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: ticket.messages.length,
                  itemBuilder: (context, index) {
                    final m = ticket.messages[index];
                    final isMe = m.senderId == ticket.raisedById;
                    return Align(
                      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 280),
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: isMe ? AppColors.navy : Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (!isMe)
                              Text(m.senderName ?? 'Support',
                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Colors.grey.shade700)),
                            Text(m.body, style: TextStyle(color: isMe ? Colors.white : Colors.black87)),
                            if (m.createdAt != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                DateFormat('MMM d, h:mm a').format(m.createdAt!.toLocal()),
                                style: TextStyle(fontSize: 10, color: isMe ? Colors.white70 : Colors.grey.shade600),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              if (ticket.isOpen)
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _replyController,
                            decoration: const InputDecoration(hintText: 'Type a reply...'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: _sending ? null : _sendReply,
                          icon: const Icon(Icons.send, color: AppColors.navy),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
