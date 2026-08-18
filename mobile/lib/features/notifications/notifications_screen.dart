import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_state_view.dart';
import '../../services/rider_service.dart';
import '../../services/rider_ws_service.dart';
import '../deliveries/delivery_detail_screen.dart';
import 'notifications_provider.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => NotificationsProvider(context.read<RiderService>(), context.read<RiderWsService>()),
      child: const _NotificationsView(),
    );
  }
}

class _NotificationsView extends StatelessWidget {
  const _NotificationsView();

  Color _typeColor(String type) {
    switch (type) {
      case 'warning':
        return AppColors.warning;
      case 'error':
        return AppColors.danger;
      default:
        return AppColors.navy;
    }
  }

  IconData _typeIcon(String type) {
    switch (type) {
      case 'warning':
        return Icons.warning_amber_outlined;
      case 'error':
        return Icons.error_outline;
      default:
        return Icons.notifications_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationsProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: RefreshIndicator(
        onRefresh: () => context.read<NotificationsProvider>().load(),
        child: AsyncStateView(
          isLoading: provider.isLoading,
          errorMessage: provider.errorMessage,
          onRetry: () => context.read<NotificationsProvider>().load(),
          isEmpty: provider.notifications.isEmpty,
          emptyMessage: 'No notifications yet',
          builder: (context) {
            final notifications = provider.notifications;
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: notifications.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final n = notifications[index];
                return Card(
                  color: n.isRead ? null : _typeColor(n.type).withValues(alpha: 0.06),
                  child: ListTile(
                    leading: Icon(_typeIcon(n.type), color: _typeColor(n.type)),
                    title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(n.message),
                        const SizedBox(height: 4),
                        Text(
                          DateFormat('MMM d, h:mm a').format(n.createdAt.toLocal()),
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                    isThreeLine: true,
                    trailing: n.orderId != null ? const Icon(Icons.chevron_right) : null,
                    onTap: () async {
                      context.read<NotificationsProvider>().markRead(n.id);
                      if (n.orderId != null) {
                        await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => DeliveryDetailScreen(orderId: n.orderId!)),
                        );
                      }
                    },
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
