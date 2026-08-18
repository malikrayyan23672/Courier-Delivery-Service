import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../dashboard/dashboard_provider.dart';
import '../dashboard/dashboard_screen.dart';
import '../profile/profile_screen.dart';

/// Root screen once the rider is logged in. Owns the single [DashboardProvider]
/// instance shared by the Dashboard and Profile tabs (see the note on
/// DashboardScreen for why that sharing matters).
class RiderShell extends StatefulWidget {
  const RiderShell({super.key});

  @override
  State<RiderShell> createState() => _RiderShellState();
}

class _RiderShellState extends State<RiderShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => DashboardProvider(context.read(), context.read(), context.read()),
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
