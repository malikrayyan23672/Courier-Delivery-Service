import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_state_view.dart';
import '../auth/auth_provider.dart';
import '../deliveries/deliveries_screen.dart';
import '../earnings/earnings_screen.dart';
import '../performance/performance_screen.dart';
import '../manifest/manifest_scan_screen.dart';
import '../notifications/notifications_screen.dart';
import '../parcels/nearby_parcels_screen.dart';
import '../support/tickets_list_screen.dart';
import '../wallet/wallet_screen.dart';
import '../../services/offline_queue_service.dart';
import 'availability_requests_screen.dart';
import 'dashboard_provider.dart';
import 'widgets/cod_wallet_card.dart';
import 'widgets/stats_row.dart';

/// Manually flushes the offline queue (confirm-pickup / mark-failed actions
/// captured while offline) instead of waiting for the automatic retry on
/// connectivity change - useful right after a rider notices they're back in
/// signal and doesn't want to wait for the next connectivity event to fire.
Future<void> _syncNow(BuildContext context) async {
  final queue = context.read<OfflineQueueService>();
  if (queue.pending.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Nothing to sync - all caught up')),
    );
    return;
  }

  final before = queue.pending.length;
  await queue.flush();
  if (!context.mounted) return;

  final after = queue.pending.length;
  final synced = before - after;
  final message = after == 0
      ? 'Synced $synced item${synced == 1 ? '' : 's'}'
      : synced > 0
          ? 'Synced $synced item${synced == 1 ? '' : 's'} - $after still waiting (no connection)'
          : 'Still offline - $after item${after == 1 ? '' : 's'} will sync automatically once you\'re back online';
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

/// Reads its [DashboardProvider] from an ancestor (provided once by
/// RiderShell and shared with ProfileScreen) rather than creating its own -
/// two independent instances would each start their own GPS ping loop.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final dashboard = context.watch<DashboardProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => context.read<DashboardProvider>().load(),
        child: AsyncStateView(
          isLoading: dashboard.isLoading,
          errorMessage: dashboard.errorMessage,
          onRetry: () => context.read<DashboardProvider>().load(),
          builder: (context) {
            final profile = dashboard.profile!;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 26,
                          backgroundColor: AppColors.navy,
                          child: Text(
                            profile.fullName.isNotEmpty ? profile.fullName[0].toUpperCase() : 'R',
                            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(profile.fullName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                              const SizedBox(height: 2),
                              Text(
                                '${profile.vehicleType ?? 'Vehicle not set'} - ⭐ ${profile.rating.toStringAsFixed(1)}',
                                style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Switch(
                              value: profile.isAvailable,
                              onChanged: (dashboard.isTogglingAvailability || dashboard.hasPendingRequest)
                                  ? null
                                  : (value) async {
                                      final provider = context.read<DashboardProvider>();
                                      await provider.requestAvailabilityChange(value);
                                      if (!context.mounted || provider.actionError == null) return;
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text(provider.actionError!)),
                                      );
                                    },
                              activeColor: AppColors.success,
                            ),
                            Text(
                              profile.isAvailable ? 'Online' : 'Offline',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: profile.isAvailable ? AppColors.success : Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                Builder(
                  builder: (context) {
                    final dropped = context.watch<OfflineQueueService>().droppedMessages;
                    if (dropped.isEmpty) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.error_outline, color: AppColors.danger, size: 18),
                                const SizedBox(width: 8),
                                const Expanded(
                                  child: Text(
                                    'Some saved actions could not be synced',
                                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: AppColors.danger),
                                  ),
                                ),
                                TextButton(
                                  onPressed: () => context.read<OfflineQueueService>().clearDroppedMessages(),
                                  child: const Text('Dismiss'),
                                ),
                              ],
                            ),
                            for (final message in dropped)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(message, style: const TextStyle(fontSize: 11.5, color: AppColors.danger)),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                if (dashboard.hasPendingRequest) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.warning.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.hourglass_top, color: AppColors.warning, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Pending approval to go ${dashboard.pendingRequestedValue == true ? 'online' : 'offline'}',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                StatsRow(stats: profile.stats),
                const SizedBox(height: 16),
                CodWalletCard(profile: profile),
                const SizedBox(height: 20),
                const Text('Quick Actions', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 10),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 3,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.95,
                  children: [
                    _QuickAction(
                      icon: Icons.local_shipping_outlined,
                      label: 'My Deliveries',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const DeliveriesScreen()),
                      ),
                    ),
                    _QuickAction(
                      icon: Icons.qr_code_scanner,
                      label: 'Scan / Returns',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const ManifestScanScreen()),
                      ),
                    ),
                    _QuickAction(
                      icon: Icons.account_balance_wallet_outlined,
                      label: 'COD Wallet',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const WalletScreen()),
                      ),
                    ),
                    _QuickAction(
                      icon: Icons.assignment_return_outlined,
                      label: 'RTO / Returns',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const ManifestScanScreen()),
                      ),
                    ),
                    Builder(
                      builder: (context) {
                        final pendingCount = context.watch<OfflineQueueService>().pending.length;
                        return _QuickAction(
                          icon: Icons.sync,
                          label: pendingCount > 0 ? 'Sync Now ($pendingCount)' : 'Sync Now',
                          onTap: () => _syncNow(context),
                        );
                      },
                    ),
                    _QuickAction(
                      icon: Icons.support_agent_outlined,
                      label: 'Support',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const TicketsListScreen()),
                      ),
                    ),
                    _QuickAction(
                      icon: Icons.account_balance_outlined,
                      label: 'Earnings',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const EarningsScreen()),
                      ),
                    ),
                    _QuickAction(
                      icon: Icons.insights_outlined,
                      label: 'Performance',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const PerformanceScreen()),
                      ),
                    ),
                    _QuickAction(
                      icon: Icons.history,
                      label: 'Availability Requests',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const AvailabilityRequestsScreen()),
                      ),
                    ),
                    _QuickAction(
                      icon: Icons.near_me_outlined,
                      label: 'Nearby Parcels',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const NearbyParcelsScreen()),
                      ),
                    ),
                    _QuickAction(
                      icon: Icons.notifications_outlined,
                      label: 'Notifications',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                      ),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _QuickAction({required this.icon, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: AppColors.navy),
              const SizedBox(height: 6),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
