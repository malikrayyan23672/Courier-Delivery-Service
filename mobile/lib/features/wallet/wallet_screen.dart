import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_state_view.dart';
import '../../models/rider_profile.dart';
import '../../models/wallet_history_entry.dart';
import '../../services/rider_service.dart';
import '../dashboard/widgets/cod_wallet_card.dart';

const _walletActionLabels = {
  'rider_wallet_locked': 'Wallet locked',
  'rider_wallet_unlocked': 'Cash deposited - wallet unlocked',
  'rider_wallet_limit_updated': 'Holding limit changed',
};

/// Dedicated COD wallet screen - reuses the same CodWalletCard shown on the
/// dashboard, plus the explicit lock/warning thresholds spelled out, since
/// the dashboard card alone doesn't show the warning threshold number.
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final _riderService = RiderService();

  RiderProfile? _profile;
  List<WalletHistoryEntry> _history = [];
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
      final results = await Future.wait([_riderService.getMe(), _riderService.getWalletHistory()]);
      setState(() {
        _profile = results[0] as RiderProfile;
        _history = results[1] as List<WalletHistoryEntry>;
      });
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('COD Wallet')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: AsyncStateView(
          isLoading: _isLoading,
          errorMessage: _errorMessage,
          onRetry: _load,
          builder: (context) {
            final profile = _profile!;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                CodWalletCard(profile: profile),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('How this works', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        const SizedBox(height: 10),
                        const _InfoRow(
                          icon: Icons.payments_outlined,
                          text: 'Every COD delivery adds the collected cash to your held balance.',
                        ),
                        const SizedBox(height: 8),
                        _InfoRow(
                          icon: Icons.warning_amber_rounded,
                          color: AppColors.warning,
                          text: 'At ${Formatters.currency(profile.codWalletWarningAt)}, you\'ll see a warning to deposit cash soon.',
                        ),
                        const SizedBox(height: 8),
                        _InfoRow(
                          icon: Icons.lock_outline,
                          color: AppColors.danger,
                          text:
                              'At ${Formatters.currency(profile.codWalletLimit)}, your wallet auto-locks and you can no longer be assigned new COD deliveries until finance verifies a cash deposit at the hub.',
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Wallet History', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        const SizedBox(height: 10),
                        if (_history.isEmpty)
                          Text('No lock, unlock or limit changes yet.', style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5))
                        else
                          ..._history.map((h) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(
                                      h.action == 'rider_wallet_locked' ? Icons.lock_outline : Icons.history,
                                      size: 16,
                                      color: h.action == 'rider_wallet_locked' ? AppColors.danger : AppColors.navy,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(_walletActionLabels[h.action] ?? h.action, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
                                          if (h.details != null)
                                            Text(h.details!, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                                          if (h.createdAt != null)
                                            Text(Formatters.dateTime(h.createdAt!), style: TextStyle(color: Colors.grey.shade400, fontSize: 11)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              )),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final Color? color;
  final String text;

  const _InfoRow({required this.icon, this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: color ?? AppColors.navy),
        const SizedBox(width: 10),
        Expanded(
          child: Text(text, style: TextStyle(color: Colors.grey.shade700, fontSize: 12.5)),
        ),
      ],
    );
  }
}
