import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/rider_profile.dart';

class CodWalletCard extends StatelessWidget {
  final RiderProfile profile;

  const CodWalletCard({super.key, required this.profile});

  @override
  Widget build(BuildContext context) {
    final locked = profile.codWalletLocked;
    final nearLimit = profile.codWalletNearLimit;
    final barColor = locked ? AppColors.danger : (nearLimit ? AppColors.warning : AppColors.success);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('COD Wallet', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                if (locked)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'FROZEN',
                      style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700, fontSize: 11),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: profile.codWalletFraction,
                minHeight: 8,
                backgroundColor: const Color(0xFFEDEFF3),
                valueColor: AlwaysStoppedAnimation(barColor),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${Formatters.currency(profile.codCashHeld)} held',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  'Limit ${Formatters.currency(profile.codWalletLimit)}',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
            if (locked) ...[
              const SizedBox(height: 10),
              Text(
                'Wallet limit reached - hand in cash at the hub for finance verification to unlock.',
                style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
              ),
            ] else if (nearLimit) ...[
              const SizedBox(height: 10),
              Text(
                'Approaching your COD limit - deposit cash soon to avoid an auto-freeze.',
                style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
