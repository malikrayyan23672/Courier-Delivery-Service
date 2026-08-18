import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'features/auth/auth_provider.dart';
import 'services/auth_service.dart';
import 'services/location_service.dart';
import 'services/offline_queue_service.dart';
import 'services/rider_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const _RiderAppRoot());
}

/// Wires up dependency injection once at the app root. Plain [Provider]s hand
/// out stateless services; [ChangeNotifierProvider]s own the app's mutable
/// session/queue state for the lifetime of the app.
class _RiderAppRoot extends StatelessWidget {
  const _RiderAppRoot();

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AuthService>(create: (_) => AuthService()),
        Provider<RiderService>(create: (_) => RiderService()),
        Provider<LocationService>(create: (context) => LocationService(context.read())),
        ChangeNotifierProvider<OfflineQueueService>(create: (context) => OfflineQueueService(context.read())),
        ChangeNotifierProvider<AuthProvider>(create: (context) => AuthProvider(context.read())),
      ],
      child: const RiderApp(),
    );
  }
}
