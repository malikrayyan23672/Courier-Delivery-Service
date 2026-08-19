import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/env.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_state_view.dart';
import '../../core/widgets/status_badge.dart';
import '../../models/address.dart';
import '../../models/order.dart';
import 'delivery_detail_provider.dart';
import 'delivery_failed_final_screen.dart';
import 'failure_reasons.dart';
import 'order_messages_screen.dart';
import 'pod/proof_of_delivery_screen.dart';

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

  /// Quick reason-only dialog for attempts 1-2 (no photo required yet - see
  /// DeliveryFailedFinalScreen for the mandatory-photo 3rd attempt). A buyer
  /// refusal is its own immediate-RTO trigger regardless of attempt count
  /// (TRD: "3 attempts exhausted OR buyer refuses"), and RTO requires proof -
  /// so picking "Customer refused" here hands off to the final screen
  /// instead of submitting straight from this dialog.
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
                items: failureReasons.keys
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

    if (selectedReason == refusedReasonLabel) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => DeliveryFailedFinalScreen(
            initialReason: selectedReason,
            initialNote: noteController.text.trim().isEmpty ? null : noteController.text.trim(),
          ),
        ),
      );
      return;
    }

    final note = noteController.text.trim().isEmpty
        ? selectedReason!
        : '$selectedReason - ${noteController.text.trim()}';

    final result = await context.read<DeliveryDetailProvider>().markFailed(
          note: note,
          reasonCode: failureReasonSlug(selectedReason!),
        );
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

    final order = provider.order;
    final canMessageSeller = order != null &&
        order.riderAccepted == true &&
        !const [OrderStatus.delivered, OrderStatus.rto, OrderStatus.cancelled].contains(order.status);

    return Scaffold(
      appBar: AppBar(
        title: Text(order?.trackingNumber ?? 'Delivery'),
        actions: [
          if (canMessageSeller)
            IconButton(
              icon: const Icon(Icons.chat_bubble_outline),
              tooltip: 'Message Seller',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => OrderMessagesScreen(trackingNumber: order.trackingNumber)),
              ),
            ),
        ],
      ),
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

  Future<void> _openInMaps() async {
    final addr = address;
    if (addr == null) return;
    // Coordinates when the address was geocoded server-side, otherwise fall
    // back to a text search on the full address - either way the rider gets
    // turn-by-turn directions in their phone's own maps app rather than no
    // navigation help at all.
    final uri = addr.lat != null && addr.lng != null
        ? Uri.parse('https://www.google.com/maps/search/?api=1&query=${addr.lat},${addr.lng}')
        : Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(addr.fullAddress)}');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.orange)),
                if (address != null)
                  GestureDetector(
                    onTap: _openInMaps,
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.directions_outlined, size: 16, color: AppColors.navy),
                        SizedBox(width: 3),
                        Text('Directions', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.navy)),
                      ],
                    ),
                  ),
              ],
            ),
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

    if (order.status == OrderStatus.pickedUp) {
      final hub = order.branchName;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            color: const Color(0xFFEAF1FC),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(hub != null ? Icons.warehouse_outlined : Icons.local_shipping_outlined, size: 18, color: AppColors.navy),
                      const SizedBox(width: 8),
                      Text(
                        hub != null ? 'Drop off at hub' : 'Direct delivery - no hub on this route',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                  if (hub != null) ...[
                    const SizedBox(height: 8),
                    Text(hub, style: const TextStyle(fontWeight: FontWeight.w600)),
                    if (order.branchAddress != null) Text(order.branchAddress!),
                    if (order.branchPhone != null)
                      Text(order.branchPhone!, style: TextStyle(color: Colors.grey.shade700, fontSize: 12.5)),
                    const SizedBox(height: 6),
                    const Text(
                      'Hand this parcel to hub staff to scan it in - it\'ll be routed onward from there.',
                      style: TextStyle(fontSize: 12.5),
                    ),
                  ] else
                    const Text('No hub is assigned on this route - deliver this parcel yourself once you\'re ready.'),
                ],
              ),
            ),
          ),
          if (hub == null) ...[
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: busy
                  ? null
                  : () async {
                      final result = await context.read<DeliveryDetailProvider>().markOutForDelivery();
                      if (!context.mounted) return;
                      if (result == ActionResult.queued) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('No connection - saved and will sync automatically')),
                        );
                      } else if (result == ActionResult.failed) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(context.read<DeliveryDetailProvider>().actionError ?? 'Failed to update')),
                        );
                      }
                    },
              icon: busy ? const _BusyIndicator() : const Icon(Icons.local_shipping_outlined),
              label: const Text('Start Delivery'),
            ),
          ],
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
            onPressed: busy
                ? null
                : order.nextFailedAttemptIsFinal
                    ? () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const DeliveryFailedFinalScreen()),
                        )
                    : onFailurePressed,
            icon: const Icon(Icons.report_gmailerrorred_outlined, color: AppColors.danger),
            label: Text(
              order.nextFailedAttemptIsFinal ? 'Mark as Failed (Final Attempt)' : 'Mark as Failed',
              style: const TextStyle(color: AppColors.danger),
            ),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.danger)),
          ),
        ],
      );
    }

    if (order.status == OrderStatus.failed) {
      return Column(
        children: [
          Card(
            color: AppColors.warning.withOpacity(0.12),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Text(
                order.nextFailedAttemptIsFinal
                    ? 'Delivery attempt ${order.failedAttemptCount} of 3 failed. The next attempt is final and will require a photo.'
                    : 'Delivery attempt ${order.failedAttemptCount} of 3 failed.',
              ),
            ),
          ),
          const SizedBox(height: 10),
          ElevatedButton.icon(
            onPressed: busy
                ? null
                : () async {
                    final result = await context.read<DeliveryDetailProvider>().retryDelivery();
                    if (!context.mounted) return;
                    if (result == ActionResult.queued) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('No connection - saved and will sync automatically')),
                      );
                    } else if (result == ActionResult.failed) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(context.read<DeliveryDetailProvider>().actionError ?? 'Failed to update')),
                      );
                    }
                  },
            icon: busy ? const _BusyIndicator() : const Icon(Icons.replay),
            label: const Text('Retry Delivery'),
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
