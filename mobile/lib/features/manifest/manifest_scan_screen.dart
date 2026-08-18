import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_state_view.dart';
import '../../models/manifest_item.dart';
import '../../models/order.dart';
import '../../services/rider_service.dart';

/// Two independent sections, both driven by manual tracking-number/crate
/// confirmation rather than camera scanning - no QR/barcode package is added
/// in this pass (see README roadmap notes), so this is fully functional
/// without any new native dependency.
class ManifestScanScreen extends StatefulWidget {
  const ManifestScanScreen({super.key});

  @override
  State<ManifestScanScreen> createState() => _ManifestScanScreenState();
}

class _ManifestScanScreenState extends State<ManifestScanScreen> {
  final _riderService = RiderService();

  List<ManifestItem>? _arrivedItems;
  List<Order>? _rtoOrders;
  bool _isLoading = true;
  String? _errorMessage;
  String? _busyId;

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
      final items = await _riderService.getArrivedManifestItems();
      final deliveries = await _riderService.getDeliveries();
      setState(() {
        _arrivedItems = items;
        _rtoOrders = deliveries.where((o) => o.status == OrderStatus.rto).toList();
      });
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _scanPickup(ManifestItem item) async {
    setState(() => _busyId = item.id);
    try {
      await _riderService.scanManifestItemPickup(item.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${item.trackingNumber ?? item.crateLabel ?? 'Parcel'} confirmed picked up')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _returnToHub(Order order) async {
    setState(() => _busyId = order.id);
    try {
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
        );
      } catch (_) {
        position = null;
      }
      await _riderService.returnToHub(order.id, lat: position?.latitude, lng: position?.longitude);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${order.trackingNumber} marked returned to hub')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan / Returns')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: AsyncStateView(
          isLoading: _isLoading,
          errorMessage: _errorMessage,
          onRetry: _load,
          builder: (context) {
            final items = _arrivedItems ?? [];
            final rtoOrders = _rtoOrders ?? [];
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text('Ready for Pickup', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 4),
                Text(
                  'Crates that have arrived at the hub for your last-mile delivery.',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5),
                ),
                const SizedBox(height: 10),
                if (items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text('Nothing waiting for pickup right now.', style: TextStyle(color: Colors.grey.shade600)),
                  )
                else
                  ...items.map((item) => Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item.trackingNumber ?? item.crateLabel ?? item.id,
                                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                                    if (item.crateLabel != null)
                                      Text('Crate: ${item.crateLabel}', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                                  ],
                                ),
                              ),
                              ElevatedButton(
                                onPressed: _busyId != null ? null : () => _scanPickup(item),
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
                                child: _busyId == item.id
                                    ? const SizedBox(
                                        height: 16,
                                        width: 16,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : const Text('Confirm Pickup'),
                              ),
                            ],
                          ),
                        ),
                      )),
                const SizedBox(height: 24),
                const Text('Return to Hub', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 4),
                Text(
                  'Parcels that failed delivery 3 times and need to be physically returned.',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5),
                ),
                const SizedBox(height: 10),
                if (rtoOrders.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text('No parcels to return right now.', style: TextStyle(color: Colors.grey.shade600)),
                  )
                else
                  ...rtoOrders.map((order) => Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(order.trackingNumber, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                              ),
                              OutlinedButton(
                                onPressed: _busyId != null ? null : () => _returnToHub(order),
                                child: _busyId == order.id
                                    ? const SizedBox(
                                        height: 16,
                                        width: 16,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      )
                                    : const Text('Mark Returned'),
                              ),
                            ],
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
}
