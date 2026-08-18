import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/config/env.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_state_view.dart';
import '../../core/widgets/status_badge.dart';
import '../../models/address.dart';
import '../../models/order.dart';
import 'delivery_detail_provider.dart';
import 'pod/proof_of_delivery_screen.dart';

const _failureReasons = [
  'Customer unavailable',
  'Customer refused',
  'Customer unreachable',
  'Customer requested reschedule',
  'Incorrect address',
  'Address inaccessible',
  'Safety issue',
  'Other',
];

class DeliveryDetailScreen extends StatelessWidget {
  final String orderId;

  const DeliveryDetailScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => DeliveryDetailProvider(context.read(), context.read(), context.read(), orderId),
      child: const _DeliveryDetailView(),
    );
  }
}

class _DeliveryDetailView extends StatelessWidget {
  const _DeliveryDetailView();

  Future<void> _showFailureDialog(BuildContext context) async {
    String? selectedReason;
    final noteController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setState) => AlertDialog(
          title: const Text('Delivery Failed'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DropdownButtonFormField<String>(
                value: selectedReason,
                decoration: const InputDecoration(labelText: 'Reason'),
                items: _failureReasons
                    .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                    .toList(),
                onChanged: (value) => setState(() => selectedReason = value),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                decoration: const InputDecoration(labelText: 'Notes (optional)'),
                maxLines: 2,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: selectedReason == null ? null : () => Navigator.pop(dialogContext, true),
              child: const Text('Submit'),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !context.mounted) return;

    final reason = noteController.text.trim().isEmpty
        ? selectedReason!
        : '$selectedReason - ${noteController.text.trim()}';

    final result = await context.read<DeliveryDetailProvider>().markFailed(reason: reason);
    if (!context.mounted) return;

    final message = switch (result) {
      ActionResult.success => 'Delivery marked as failed',
      ActionResult.queued => 'No connection - saved and will sync automatically',
      ActionResult.failed => context.read<DeliveryDetailProvider>().actionError ?? 'Failed to update',
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _showUnlockRequestDialog(BuildContext context) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Request Unlock'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('A staff/admin approver needs to approve this before the parcel is released.'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(labelText: 'Reason (optional)'),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Submit Request')),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    final reason = reasonController.text.trim().isEmpty ? null : reasonController.text.trim();
    final result = await context.read<DeliveryDetailProvider>().requestUnlock(reason: reason);
    if (!context.mounted) return;

    final message = switch (result) {
      ActionResult.success => 'Unlock request submitted - waiting on approval',
      ActionResult.queued => 'No connection - saved and will submit automatically',
      ActionResult.failed => context.read<DeliveryDetailProvider>().actionError ?? 'Could not submit request',
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<DeliveryDetailProvider>();

    return Scaffold(
      appBar: AppBar(title: Text(provider.order?.trackingNumber ?? 'Delivery')),
      body: AsyncStateView(
        isLoading: provider.isLoading,
        errorMessage: provider.errorMessage,
        onRetry: () => context.read<DeliveryDetailProvider>().load(),
        builder: (context) {
          final order = provider.order!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  StatusBadge(status: order.status),
                  if (order.codAmount != null)
                    Text(
                      'COD: ${Formatters.currency(order.codAmount)}',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.navy),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              _AddressCard(title: 'Pickup', address: order.pickupAddress),
              const SizedBox(height: 12),
              _AddressCard(title: 'Drop-off', address: order.dropoffAddress),
              if (order.packageDescription != null || order.packageWeightKg != null) ...[
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Package', style: TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        if (order.packageDescription != null) Text(order.packageDescription!),
                        if (order.packageWeightKg != null) Text('${order.packageWeightKg} kg'),
                      ],
                    ),
                  ),
                ),
              ],
              if (order.status == OrderStatus.delivered && order.proofOfDeliveryUrl != null) ...[
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Proof of Delivery', style: TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network('${Env.apiOrigin}${order.proofOfDeliveryUrl}'),
                        ),
                        if (order.proofOfDeliveryRecipientName != null) ...[
                          const SizedBox(height: 8),
                          Text('Received by ${order.proofOfDeliveryRecipientName}'),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
              if (order.trackingEvents.isNotEmpty) ...[
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Timeline', style: TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        ...order.trackingEvents.reversed.map(
                          (e) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                SizedBox(
                                  width: 70,
                                  child: Text(
                                    Formatters.time(e.createdAt),
                                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                                  ),
                                ),
                                Expanded(
                                  child: Text(
                                    '${Formatters.statusLabel(e.status)}${e.note != null ? ' - ${e.note}' : ''}',
                                    style: const TextStyle(fontSize: 12.5),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              _ActionArea(
                order: order,
                onFailurePressed: () => _showFailureDialog(context),
                onUnlockRequestPressed: () => _showUnlockRequestDialog(context),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _AddressCard extends StatelessWidget {
  final String title;
  final Address? address;

  const _AddressCard({required this.title, required this.address});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.orange)),
            const SizedBox(height: 6),
            Text(address?.fullAddress ?? '—'),
            if (address?.contactName != null) ...[
              const SizedBox(height: 4),
              Text('${address!.contactName}${address!.contactPhone != null ? ' - ${address!.contactPhone}' : ''}',
                  style: TextStyle(color: Colors.grey.shade700, fontSize: 12.5)),
            ],
          ],
        ),
      ),
    );
  }
}

class _ActionArea extends StatelessWidget {
  final Order order;
  final VoidCallback onFailurePressed;
  final VoidCallback onUnlockRequestPressed;

  const _ActionArea({required this.order, required this.onFailurePressed, required this.onUnlockRequestPressed});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<DeliveryDetailProvider>();
    final busy = provider.isActing;

    if (order.isPendingOffer) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: busy
                  ? null
                  : () => context.read<DeliveryDetailProvider>().respondToOffer(accept: false),
              child: const Text('Decline'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              onPressed: busy
                  ? null
                  : () => context.read<DeliveryDetailProvider>().respondToOffer(accept: true),
              child: busy ? const _BusyIndicator() : const Text('Accept'),
            ),
          ),
        ],
      );
    }

    if (order.status == OrderStatus.assigned && order.riderAccepted == true) {
      final hasPendingUnlock = context.watch<DeliveryDetailProvider>().hasPendingUnlockRequest;
      return Column(
        children: [
          ElevatedButton.icon(
            onPressed: busy
                ? null
                : () async {
                    final result = await context.read<DeliveryDetailProvider>().confirmPickup();
                    if (!context.mounted) return;
                    if (result == ActionResult.queued) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('No connection - saved and will sync automatically')),
                      );
                    } else if (result == ActionResult.failed) {
                      final provider = context.read<DeliveryDetailProvider>();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(provider.actionError ?? 'Failed to update'),
                          action: provider.actionErrorNeedsLocationSettings
                              ? SnackBarAction(label: 'Settings', onPressed: provider.openLocationSettings)
                              : null,
                        ),
                      );
                    }
                  },
            icon: busy ? const _BusyIndicator() : const Icon(Icons.check_circle_outline),
            label: const Text('Confirm Pickup'),
          ),
          const SizedBox(height: 10),
          if (hasPendingUnlock)
            const Text(
              'Unlock request pending approval',
              style: TextStyle(color: AppColors.warning, fontWeight: FontWeight.w600, fontSize: 12.5),
            )
          else
            OutlinedButton.icon(
              onPressed: busy ? null : onUnlockRequestPressed,
              icon: const Icon(Icons.lock_open_outlined),
              label: const Text('Request Unlock'),
            ),
        ],
      );
    }

    if (order.status == OrderStatus.inHub || order.status == OrderStatus.inTransit) {
      return Card(
        color: const Color(0xFFEAF1FC),
        child: const Padding(
          padding: EdgeInsets.all(14),
          child: Text('This parcel is moving through the hub network. It\'ll reach your next '
              'available action once it arrives at the destination hub.'),
        ),
      );
    }

    if (order.status == OrderStatus.outForDelivery) {
      return Column(
        children: [
          ElevatedButton.icon(
            onPressed: busy
                ? null
                : () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => ProofOfDeliveryScreen(orderId: order.id)),
                    ),
            icon: const Icon(Icons.camera_alt_outlined),
            label: const Text('Complete Delivery'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy ? null : onFailurePressed,
            icon: const Icon(Icons.report_gmailerrorred_outlined, color: AppColors.danger),
            label: const Text('Mark as Failed', style: TextStyle(color: AppColors.danger)),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.danger)),
          ),
        ],
      );
    }

    return const SizedBox.shrink();
  }
}

class _BusyIndicator extends StatelessWidget {
  const _BusyIndicator();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 18,
      width: 18,
      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
    );
  }
}
