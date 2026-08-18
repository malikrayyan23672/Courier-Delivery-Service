import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/widgets/async_state_view.dart';
import '../../models/order.dart';
import 'deliveries_provider.dart';
import 'delivery_detail_screen.dart';
import 'widgets/delivery_list_tile.dart';

class DeliveriesScreen extends StatelessWidget {
  const DeliveriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => DeliveriesProvider(context.read()),
      child: const _DeliveriesView(),
    );
  }
}

class _DeliveriesView extends StatelessWidget {
  const _DeliveriesView();

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<DeliveriesProvider>();

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('My Deliveries'),
          bottom: TabBar(
            indicatorColor: Colors.white,
            tabs: [
              Tab(text: 'Offers (${provider.pendingOffers.length})'),
              Tab(text: 'Active (${provider.active.length})'),
              const Tab(text: 'History'),
            ],
          ),
        ),
        body: RefreshIndicator(
          onRefresh: () => context.read<DeliveriesProvider>().load(),
          child: AsyncStateView(
            isLoading: provider.isLoading,
            errorMessage: provider.errorMessage,
            onRetry: () => context.read<DeliveriesProvider>().load(),
            builder: (context) => TabBarView(
              children: [
                _OrderList(
                  orders: provider.pendingOffers,
                  emptyMessage: 'No pending offers',
                  emptyIcon: Icons.inbox_outlined,
                ),
                _OrderList(
                  orders: provider.active,
                  emptyMessage: 'Nothing active right now',
                  emptyIcon: Icons.local_shipping_outlined,
                ),
                _OrderList(
                  orders: provider.history,
                  emptyMessage: 'No delivery history yet',
                  emptyIcon: Icons.history,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderList extends StatelessWidget {
  final List<Order> orders;
  final String emptyMessage;
  final IconData emptyIcon;

  const _OrderList({required this.orders, required this.emptyMessage, required this.emptyIcon});

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 80),
          Center(child: Icon(emptyIcon, size: 40, color: Colors.grey.shade400)),
          const SizedBox(height: 12),
          Center(child: Text(emptyMessage, style: TextStyle(color: Colors.grey.shade600))),
        ],
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: orders.length,
      itemBuilder: (context, index) {
        final order = orders[index];
        return DeliveryListTile(
          order: order,
          onTap: () async {
            await Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => DeliveryDetailScreen(orderId: order.id)),
            );
            if (context.mounted) {
              context.read<DeliveriesProvider>().load();
            }
          },
        );
      },
    );
  }
}
