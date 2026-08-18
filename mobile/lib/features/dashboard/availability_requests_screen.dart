import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_state_view.dart';
import '../../models/status_request.dart';
import '../../services/rider_service.dart';

/// Read-only history of the rider's own availability change requests
/// (pending / approved / rejected) - a simple StatefulWidget rather than a
/// dedicated provider, matching how this app keeps simple read-only screens
/// simple.
class AvailabilityRequestsScreen extends StatefulWidget {
  const AvailabilityRequestsScreen({super.key});

  @override
  State<AvailabilityRequestsScreen> createState() => _AvailabilityRequestsScreenState();
}

class _AvailabilityRequestsScreenState extends State<AvailabilityRequestsScreen> {
  final _riderService = RiderService();

  List<StatusRequest>? _requests;
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
      final requests = await _riderService.getAvailabilityRequests();
      setState(() => _requests = requests);
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'approved':
        return AppColors.success;
      case 'rejected':
        return AppColors.danger;
      default:
        return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Availability Requests')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: AsyncStateView(
          isLoading: _isLoading,
          errorMessage: _errorMessage,
          onRetry: _load,
          isEmpty: _requests != null && _requests!.isEmpty,
          emptyMessage: "You haven't requested an availability change yet.",
          builder: (context) {
            final requests = _requests!;
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: requests.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final r = requests[index];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              r.requestedIsAvailable ? Icons.toggle_on : Icons.toggle_off,
                              color: AppColors.navy,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              r.requestedIsAvailable ? 'Go Online' : 'Go Offline',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: _statusColor(r.status).withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                r.status[0].toUpperCase() + r.status.substring(1),
                                style: TextStyle(
                                  color: _statusColor(r.status),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (r.createdAt != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            'Requested ${DateFormat('MMM d, h:mm a').format(r.createdAt!.toLocal())}',
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                          ),
                        ],
                        if (r.resolutionNote != null && r.resolutionNote!.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            'Note: ${r.resolutionNote}',
                            style: TextStyle(color: Colors.grey.shade700, fontSize: 12.5),
                          ),
                        ],
                      ],
                    ),
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
