import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_state_view.dart';
import '../../models/support_ticket.dart';
import '../../services/rider_service.dart';
import 'new_ticket_screen.dart';
import 'ticket_detail_screen.dart';

class TicketsListScreen extends StatefulWidget {
  const TicketsListScreen({super.key});

  @override
  State<TicketsListScreen> createState() => _TicketsListScreenState();
}

class _TicketsListScreenState extends State<TicketsListScreen> {
  final _riderService = RiderService();

  List<SupportTicket>? _tickets;
  bool _isLoading = true;
  String? _errorMessage;

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
      final tickets = await _riderService.getSupportTickets();
      setState(() => _tickets = tickets);
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'resolved':
      case 'closed':
        return AppColors.success;
      case 'in_progress':
        return AppColors.warning;
      default:
        return AppColors.navy;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Support')),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.orange,
        onPressed: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NewTicketScreen()));
          _load();
        },
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: AsyncStateView(
          isLoading: _isLoading,
          errorMessage: _errorMessage,
          onRetry: _load,
          isEmpty: _tickets != null && _tickets!.isEmpty,
          emptyMessage: 'No support tickets yet. Tap + to open one.',
          builder: (context) {
            final tickets = _tickets!;
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: tickets.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final t = tickets[index];
                return Card(
                  child: ListTile(
                    title: Text(t.subject, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(
                      t.status[0].toUpperCase() + t.status.substring(1).replaceAll('_', ' '),
                      style: TextStyle(color: _statusColor(t.status), fontWeight: FontWeight.w600),
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => TicketDetailScreen(ticketId: t.id)),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
