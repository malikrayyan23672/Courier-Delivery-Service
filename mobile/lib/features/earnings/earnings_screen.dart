import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/async_state_view.dart';
import '../../models/earnings.dart';
import '../../services/rider_service.dart';

/// Plain list of day rows + a total card - no chart library is added since
/// none exists in this app today and a list is sufficient.
class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  final _riderService = RiderService();

  EarningsBreakdown? _earnings;
  bool _isLoading = true;
  String? _errorMessage;
  int _days = 7;

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
      final earnings = await _riderService.getEarnings(days: _days);
      setState(() => _earnings = earnings);
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _setDays(int days) {
    setState(() => _days = days);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Earnings')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: AsyncStateView(
          isLoading: _isLoading,
          errorMessage: _errorMessage,
          onRetry: _load,
          builder: (context) {
            final earnings = _earnings!;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [7, 14, 30].map((d) {
                    final selected = d == _days;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text('$d days'),
                        selected: selected,
                        onSelected: (_) => _setDays(d),
                        selectedColor: AppColors.navy,
                        labelStyle: TextStyle(color: selected ? Colors.white : Colors.black87),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                Card(
                  color: AppColors.navy,
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total earnings', style: TextStyle(color: Colors.white70, fontSize: 12.5)),
                        const SizedBox(height: 6),
                        Text(
                          Formatters.currency(earnings.totalEarnings),
                          style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        Text('${earnings.totalDeliveries} deliveries', style: const TextStyle(color: Colors.white70, fontSize: 12.5)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text('Daily breakdown', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 10),
                if (earnings.daily.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text('No deliveries in this period.', style: TextStyle(color: Colors.grey.shade600)),
                  )
                else
                  ...earnings.daily.map((day) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text(_formatDate(day.date)),
                          subtitle: Text('${day.deliveries} ${day.deliveries == 1 ? 'delivery' : 'deliveries'}'),
                          trailing: Text(
                            Formatters.currency(day.earnings),
                            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.navy),
                          ),
                        ),
                      )),
              ],
            );
          },
        ),
      ),
    );
  }

  String _formatDate(String isoDate) {
    final parsed = DateTime.tryParse(isoDate);
    return parsed != null ? DateFormat('EEE, MMM d').format(parsed) : isoDate;
  }
}
