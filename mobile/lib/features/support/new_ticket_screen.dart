import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/offline_queue_service.dart';
import 'ticket_detail_screen.dart';

class NewTicketScreen extends StatefulWidget {
  const NewTicketScreen({super.key});

  @override
  State<NewTicketScreen> createState() => _NewTicketScreenState();
}

class _NewTicketScreenState extends State<NewTicketScreen> {
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  bool _submitting = false;
  String? _error;

  Future<void> _submit() async {
    if (_subjectController.text.trim().isEmpty || _messageController.text.trim().isEmpty) {
      setState(() => _error = 'Please fill in both fields');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final (outcome, ticket) = await context.read<OfflineQueueService>().submitSupportTicketCreate(
            subject: _subjectController.text.trim(),
            message: _messageController.text.trim(),
          );
      if (!mounted) return;
      if (outcome == QueuedActionOutcome.queued) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No connection - ticket saved and will be submitted automatically')),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => TicketDetailScreen(ticketId: ticket!.id)),
        );
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New Support Ticket')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _subjectController,
              decoration: const InputDecoration(labelText: 'Subject'),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _messageController,
              decoration: const InputDecoration(labelText: 'Describe the issue'),
              maxLines: 5,
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                    )
                  : const Text('Submit'),
            ),
          ],
        ),
      ),
    );
  }
}
