import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_state_view.dart';
import '../../models/performance.dart';
import '../../services/rider_service.dart';

/// Delivered-vs-returned trend over time. `rider.rating` is shown for
/// context, but nothing in the backend ever recalculates it (no rider-rating
/// flow exists yet) - the real trend signal here is the daily outcome split.
class PerformanceScreen extends StatefulWidget {
  const PerformanceScreen({super.key});

  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  final _riderService = RiderService();

  Performance? _performance;
  bool _isLoading = true;
  String? _errorMessage;
  int _days = 30;

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
      final performance = await _riderService.getPerformance(days: _days);
      setState(() => _performance = performance);
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
      appBar: AppBar(title: const Text('Performance')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: AsyncStateView(
          isLoading: _isLoading,
          errorMessage: _errorMessage,
          onRetry: _load,
          builder: (context) {
            final performance = _performance!;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [7, 30, 90].map((d) {
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
                Row(
                  children: [
                    Expanded(
                      child: Card(
                        color: AppColors.navy,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Success rate', style: TextStyle(color: Colors.white70, fontSize: 12.5)),
                              const SizedBox(height: 6),
                              Text('${performance.successRate}%', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
                              const SizedBox(height: 4),
                              Text('${performance.totalDelivered} delivered · ${performance.totalFailed} rto', style: const TextStyle(color: Colors.white70, fontSize: 11.5)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Rating', style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5)),
                              const SizedBox(height: 6),
                              Text('⭐ ${performance.rating.toStringAsFixed(1)}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Text('Daily breakdown', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 10),
                if (performance.daily.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text('No completed deliveries in this period.', style: TextStyle(color: Colors.grey.shade600)),
                  )
                else
                  ...performance.daily.map((day) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text(_formatDate(day.date)),
                          subtitle: Text('${day.delivered} delivered${day.failed > 0 ? ' · ${day.failed} rto' : ''}'),
                          trailing: Icon(
                            day.failed == 0 ? Icons.check_circle_outline : Icons.error_outline,
                            color: day.failed == 0 ? AppColors.success : AppColors.warning,
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
