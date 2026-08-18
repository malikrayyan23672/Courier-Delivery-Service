import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/rider_ws_service.dart';
import '../dashboard/dashboard_provider.dart';
import '../dashboard/dashboard_screen.dart';
import '../profile/profile_screen.dart';

/// Root screen once the rider is logged in. Owns the single [DashboardProvider]
/// instance shared by the Dashboard and Profile tabs (see the note on
/// DashboardScreen for why that sharing matters).
///
/// Also owns the [RiderWsService] connection lifetime - this widget is only
/// ever mounted while authenticated (see app.dart's _RootRouter), so
/// connecting here and disconnecting in dispose() ties the socket exactly
/// to the logged-in session without AuthProvider needing to know about it.
class RiderShell extends StatefulWidget {
  const RiderShell({super.key});

  @override
  State<RiderShell> createState() => _RiderShellState();
}

class _RiderShellState extends State<RiderShell> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    context.read<RiderWsService>().connect();
  }

  @override
  void dispose() {
    context.read<RiderWsService>().disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => DashboardProvider(context.read(), context.read(), context.read(), context.read()),
      child: Scaffold(
        body: IndexedStack(
          index: _index,
          children: const [DashboardScreen(), ProfileScreen()],
        ),
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _index,
          onTap: (index) => setState(() => _index = index),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), label: 'Dashboard'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Profile'),
          ],
        ),
      ),
    );
  }
}
