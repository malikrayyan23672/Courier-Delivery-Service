import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_state_view.dart';
import '../../models/order.dart';
import '../../services/rider_service.dart';
import '../deliveries/delivery_detail_screen.dart';

/// Unassigned nearby parcels a rider can self-claim, sorted server-side by
/// distance where geocoding is available. A simple StatefulWidget rather
/// than a dedicated provider, matching how this app keeps read-mostly
/// screens simple.
class NearbyParcelsScreen extends StatefulWidget {
  const NearbyParcelsScreen({super.key});

  @override
  State<NearbyParcelsScreen> createState() => _NearbyParcelsScreenState();
}

class _NearbyParcelsScreenState extends State<NearbyParcelsScreen> {
  final _riderService = RiderService();

  List<Order>? _parcels;
  bool _isLoading = true;
  String? _errorMessage;
  String? _lockingOrderId;

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
      final parcels = await _riderService.getNearbyParcels();
      setState(() => _parcels = parcels);
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _lock(Order order) async {
    setState(() => _lockingOrderId = order.id);
    try {
      await _riderService.lockParcel(order.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${order.trackingNumber} claimed')),
      );
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => DeliveryDetailScreen(orderId: order.id)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
      await _load();
    } finally {
      if (mounted) setState(() => _lockingOrderId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nearby Parcels')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: AsyncStateView(
          isLoading: _isLoading,
          errorMessage: _errorMessage,
          onRetry: _load,
          isEmpty: _parcels != null && _parcels!.isEmpty,
          emptyMessage: 'No unclaimed parcels nearby right now.',
          builder: (context) {
            final parcels = _parcels!;
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: parcels.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final order = parcels[index];
                final locking = _lockingOrderId == order.id;
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(order.trackingNumber, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        const SizedBox(height: 6),
                        Text(
                          order.pickupAddress?.fullAddress ?? 'Pickup address not set',
                          style: TextStyle(color: Colors.grey.shade700, fontSize: 12.5),
                        ),
                        if (order.packageDescription != null) ...[
                          const SizedBox(height: 4),
                          Text(order.packageDescription!, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                        ],
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: (_lockingOrderId != null) ? null : () => _lock(order),
                            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
                            child: locking
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                                  )
                                : const Text('Lock / Claim'),
                          ),
                        ),
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
