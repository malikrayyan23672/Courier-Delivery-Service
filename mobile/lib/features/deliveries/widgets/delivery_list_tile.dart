import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/order.dart';

class DeliveryListTile extends StatelessWidget {
  final Order order;
  final VoidCallback onTap;

  const DeliveryListTile({super.key, required this.order, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(order.trackingNumber, style: const TextStyle(fontWeight: FontWeight.w700)),
                  StatusBadge(status: order.status),
                ],
              ),
              const SizedBox(height: 10),
              _AddressLine(icon: Icons.circle_outlined, text: order.pickupAddress?.fullAddress ?? '—'),
              const SizedBox(height: 4),
              _AddressLine(icon: Icons.location_on_outlined, text: order.dropoffAddress?.fullAddress ?? '—'),
              if (order.finalPrice != null || order.estimatedPrice != null) ...[
                const SizedBox(height: 10),
                Text(
                  Formatters.currency(order.finalPrice ?? order.estimatedPrice),
                  style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.navy),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _AddressLine extends StatelessWidget {
  final IconData icon;
  final String text;

  const _AddressLine({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: Colors.grey.shade500),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700),
          ),
        ),
      ],
    );
  }
}
