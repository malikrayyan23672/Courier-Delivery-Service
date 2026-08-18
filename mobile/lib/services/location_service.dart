import 'dart:async';

import 'package:geolocator/geolocator.dart';

import 'rider_service.dart';

/// Thrown by [LocationService.getCurrentPosition] instead of returning null,
/// so a user-initiated action (confirm pickup, complete delivery) can tell the
/// rider *why* it failed and, when [isPermanentlyDenied] is true, offer a way
/// to fix it (opening app settings) rather than a dead-end error message.
class LocationPermissionException implements Exception {
  final bool isPermanentlyDenied;
  LocationPermissionException({required this.isPermanentlyDenied});

  String get message => isPermanentlyDenied
      ? 'Location access is turned off for this app. Enable it in Settings to continue.'
      : 'Location permission is required to continue.';

  @override
  String toString() => message;
}

class LocationServiceDisabledError implements Exception {
  @override
  String toString() => 'Turn on device location (GPS) to continue.';
}

/// Foreground-only GPS ping loop (spec section 42/54 - full background tracking
/// and Redis-backed live location need a foreground service + push infra and
/// are deferred to a later phase). While the rider is online and the app is in
/// the foreground, this pushes a location update to the backend every
/// [interval] so admin/hub live-tracking views stay current.
class LocationService {
  LocationService(this._riderService);

  final RiderService _riderService;
  Timer? _timer;

  static const interval = Duration(seconds: 20);

  bool get isRunning => _timer != null;

  /// True if permission is granted and won't prompt again this call.
  Future<bool> ensurePermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) return false;
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }

  /// Resolves the rider's current position, or throws [LocationPermissionException]
  /// / [LocationServiceDisabledError] describing exactly what's blocking it, so the
  /// caller can show a targeted message instead of a generic failure.
  Future<Position> getCurrentPosition() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      throw LocationPermissionException(isPermanentlyDenied: true);
    }
    if (permission == LocationPermission.denied) {
      throw LocationPermissionException(isPermanentlyDenied: false);
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw LocationServiceDisabledError();
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  Future<void> openLocationSettings() => Geolocator.openAppSettings();

  /// Starts pushing this rider's location to the server on a fixed interval.
  Future<void> start() async {
    if (isRunning) return;
    final granted = await ensurePermission();
    if (!granted) return;

    _pushCurrentLocation();
    _timer = Timer.periodic(interval, (_) => _pushCurrentLocation());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _pushCurrentLocation() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      await _riderService.updateLocation(lat: position.latitude, lng: position.longitude);
    } catch (_) {
      // Best-effort - a missed ping isn't worth surfacing to the rider;
      // the next tick will try again.
    }
  }

  void dispose() => stop();
}
