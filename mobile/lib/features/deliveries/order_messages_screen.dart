import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_state_view.dart';
import '../../models/order_message.dart';
import 'delivery_detail_provider.dart';

/// Order-scoped chat with the parcel's seller - e.g. to explain a repeatedly
/// failed delivery before it's returned to origin. Mirrors
/// features/support/ticket_detail_screen.dart's layout.
class OrderMessagesScreen extends StatefulWidget {
  final String trackingNumber;

  const OrderMessagesScreen({super.key, required this.trackingNumber});

  @override
  State<OrderMessagesScreen> createState() => _OrderMessagesScreenState();
}

class _OrderMessagesScreenState extends State<OrderMessagesScreen> {
  final _replyController = TextEditingController();

  List<OrderMessage>? _messages;
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
      final provider = context.read<DeliveryDetailProvider>();
      final messages = await provider.loadOrderMessages();
      setState(() => _messages = messages);
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _send() async {
    final body = _replyController.text.trim();
    if (body.isEmpty) return;
    setState(() => _sending = true);
    try {
      await context.read<DeliveryDetailProvider>().sendOrderMessage(body);
      _replyController.clear();
      await _load();
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
      appBar: AppBar(title: Text('Message Seller · ${widget.trackingNumber}')),
      body: AsyncStateView(
        isLoading: _isLoading,
        errorMessage: _errorMessage,
        onRetry: _load,
        builder: (context) {
          final messages = _messages ?? const [];
          return Column(
            children: [
              Expanded(
                child: messages.isEmpty
                    ? Center(
                        child: Text(
                          'No messages yet - say hello to the seller.',
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: messages.length,
                        itemBuilder: (context, index) {
                          final m = messages[index];
                          final isMe = m.senderRole == 'rider';
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
                                    Text(m.senderName ?? 'Seller',
                                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Colors.grey.shade700)),
                                  Text(m.body, style: TextStyle(color: isMe ? Colors.white : Colors.black87)),
                                  const SizedBox(height: 4),
                                  Text(
                                    DateFormat('MMM d, h:mm a').format(m.createdAt.toLocal()),
                                    style: TextStyle(fontSize: 10, color: isMe ? Colors.white70 : Colors.grey.shade600),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _replyController,
                          decoration: const InputDecoration(hintText: 'Message the seller...'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: _sending ? null : _send,
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
