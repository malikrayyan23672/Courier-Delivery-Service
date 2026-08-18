import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../auth/auth_provider.dart';
import '../dashboard/dashboard_provider.dart';

/// Shares the same [DashboardProvider] instance as DashboardScreen (provided
/// once by RiderShell) so toggling availability here or on the dashboard
/// tab stays in sync, and only one GPS ping loop ever runs.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final dashboard = context.watch<DashboardProvider>();
    final profile = dashboard.profile;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: profile == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Center(
                  child: CircleAvatar(
                    radius: 40,
                    backgroundColor: AppColors.navy,
                    child: Text(
                      profile.fullName.isNotEmpty ? profile.fullName[0].toUpperCase() : 'R',
                      style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: Text(profile.fullName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                ),
                Center(
                  child: Text(
                    profile.vehicleType ?? 'Vehicle not set',
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                ),
                const SizedBox(height: 24),
                Card(
                  child: Column(
                    children: [
                      _InfoRow(label: 'Status', value: profile.status),
                      const Divider(height: 1),
                      _InfoRow(label: 'Rating', value: '⭐ ${profile.rating.toStringAsFixed(1)}'),
                      const Divider(height: 1),
                      _InfoRow(label: 'Availability', value: profile.isAvailable ? 'Online' : 'Offline'),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: () => context.read<AuthProvider>().logout(),
                  icon: const Icon(Icons.logout, color: AppColors.danger),
                  label: const Text('Log Out', style: TextStyle(color: AppColors.danger)),
                  style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.danger)),
                ),
              ],
            ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade600)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
