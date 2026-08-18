import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../core/config/env.dart';
import '../core/network/token_storage.dart';

/// A push event received over the rider WebSocket - currently just "new
/// assignment", but kept generic (`type`) since the backend's Notification
/// system can grow beyond order assignment later without a client change.
class RiderWsEvent {
  final String type;
  final String? orderId;
  final String title;
  final String message;

  RiderWsEvent({required this.type, this.orderId, required this.title, required this.message});

  factory RiderWsEvent.fromJson(Map<String, dynamic> json) => RiderWsEvent(
        type: json['type'] as String? ?? 'notification',
        orderId: json['order_id'] as String?,
        title: json['title'] as String? ?? '',
        message: json['message'] as String? ?? '',
      );
}

/// Receive-only real-time channel from the backend: pushes an event the
/// instant a new order is assigned/offered to this rider, so the app
/// doesn't have to wait for a pull-to-refresh. Writes still go exclusively
/// through OfflineQueueService - this client never sends anything after the
/// handshake.
///
/// Reconnects with exponential backoff (2s -> capped at 30s) on drop, which
/// also covers a background/foreground cycle (there's no AppLifecycleState
/// hook in this app yet - relying on the backoff loop to recover keeps a
/// reconnect within the same ~30s staleness window the offline queue's own
/// sync engine already treats as acceptable).
class RiderWsService {
  final _controller = StreamController<RiderWsEvent>.broadcast();
  Stream<RiderWsEvent> get events => _controller.stream;

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  Duration _backoff = const Duration(seconds: 2);
  static const _maxBackoffSeconds = 30;
  bool _connectRequested = false;

  Future<void> connect() async {
    _connectRequested = true;
    await _open();
  }

  Future<void> _open() async {
    if (!_connectRequested || _channel != null) return;

    final token = await TokenStorage.instance.accessToken;
    if (token == null || !_connectRequested) return;

    try {
      final channel = WebSocketChannel.connect(_wsUri(token));
      // WebSocketChannel.connect() doesn't throw synchronously - it returns
      // immediately and connects in the background. A rejected handshake
      // (e.g. an expired token) only surfaces by awaiting `ready`; without
      // this, the failure becomes an unhandled Future error instead of
      // reaching the catch block below, and _scheduleReconnect() never
      // fires - the retry loop would silently die on the first failure.
      await channel.ready;
      if (!_connectRequested) {
        await channel.sink.close();
        return;
      }
      _channel = channel;
      _subscription = channel.stream.listen(
        _handleMessage,
        onDone: _scheduleReconnect,
        onError: (_) => _scheduleReconnect(),
        cancelOnError: true,
      );
      _backoff = const Duration(seconds: 2);
    } catch (_) {
      _channel = null;
      _scheduleReconnect();
    }
  }

  Uri _wsUri(String token) {
    final base = Uri.parse(Env.apiBaseUrl);
    final scheme = base.scheme == 'https' ? 'wss' : 'ws';
    return base.replace(
      scheme: scheme,
      path: '${base.path}/ws/rider',
      queryParameters: {'token': token},
    );
  }

  void _handleMessage(dynamic raw) {
    try {
      final json = jsonDecode(raw as String) as Map<String, dynamic>;
      _controller.add(RiderWsEvent.fromJson(json));
    } catch (_) {
      // Malformed frame - ignore rather than crash the listener.
    }
  }

  void _scheduleReconnect() {
    _subscription?.cancel();
    _subscription = null;
    _channel = null;
    if (!_connectRequested) return;

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(_backoff, _open);
    _backoff = Duration(seconds: (_backoff.inSeconds * 2).clamp(2, _maxBackoffSeconds));
  }

  void disconnect() {
    _connectRequested = false;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _subscription?.cancel();
    _subscription = null;
    _channel?.sink.close();
    _channel = null;
  }

  void dispose() {
    disconnect();
    _controller.close();
  }
}
