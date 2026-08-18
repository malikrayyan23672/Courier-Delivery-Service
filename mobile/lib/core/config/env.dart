/// Runtime configuration, overridable at build/run time with --dart-define.
///
/// Examples:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.50:8000/api/v1
///   flutter build apk --dart-define=API_BASE_URL=https://api.raftaarexpress.com/api/v1
class Env {
  Env._();

  /// Defaults to the dev machine's LAN IP, for running on a physical device
  /// over wireless debugging. Override with --dart-define for the emulator
  /// (http://10.0.2.2:8000/api/v1) or the deployed API URL for a release build.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://172.16.16.15:8000/api/v1',
  );

  /// Server origin (no /api/v1 suffix) - used to resolve relative URLs the
  /// API returns for static assets, e.g. proof-of-delivery photos under /uploads.
  static String get apiOrigin =>
      apiBaseUrl.endsWith('/api/v1') ? apiBaseUrl.substring(0, apiBaseUrl.length - '/api/v1'.length) : apiBaseUrl;
}
