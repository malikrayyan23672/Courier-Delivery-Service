import 'dart:async';

import 'package:dio/dio.dart';

import '../config/env.dart';
import 'token_storage.dart';

/// Central Dio instance for every authenticated call the app makes.
///
/// Handles:
/// - attaching the bearer access token to every request
/// - transparently refreshing an expired access token on a 401 and retrying
///   the original request once
/// - clearing the session and notifying the app when the refresh token itself
///   is no longer valid (forces the rider back to the login screen)
class ApiClient {
  ApiClient._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 30),
      ),
    );

    // Bare Dio instance for the refresh call itself - must never go through
    // the auth interceptor below, or a failed refresh would try to refresh itself.
    _refreshDio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl));

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await TokenStorage.instance.accessToken;
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isUnauthorized = error.response?.statusCode == 401;
          final alreadyRetried = error.requestOptions.extra['retried'] == true;

          if (!isUnauthorized || alreadyRetried) {
            handler.next(error);
            return;
          }

          final refreshed = await _refreshAccessToken();
          if (!refreshed) {
            await TokenStorage.instance.clear();
            onSessionExpired?.call();
            handler.next(error);
            return;
          }

          try {
            final retryOptions = error.requestOptions;
            retryOptions.extra['retried'] = true;
            final newToken = await TokenStorage.instance.accessToken;
            retryOptions.headers['Authorization'] = 'Bearer $newToken';
            final response = await _dio.fetch(retryOptions);
            handler.resolve(response);
          } catch (_) {
            handler.next(error);
          }
        },
      ),
    );
  }

  static final ApiClient instance = ApiClient._internal();

  late final Dio _dio;
  late final Dio _refreshDio;

  /// Set by the app shell so a hard-expired session can route back to login.
  void Function()? onSessionExpired;

  Dio get dio => _dio;

  Completer<bool>? _refreshInFlight;

  /// Coalesces concurrent 401s behind a single refresh call.
  Future<bool> _refreshAccessToken() async {
    if (_refreshInFlight != null) {
      return _refreshInFlight!.future;
    }

    final completer = Completer<bool>();
    _refreshInFlight = completer;

    try {
      final refreshToken = await TokenStorage.instance.refreshToken;
      if (refreshToken == null) {
        completer.complete(false);
        return completer.future;
      }

      final response = await _refreshDio.post(
        '/auth/refresh',
        data: {'refresh_token': refreshToken},
      );

      final accessToken = response.data['access_token'] as String;
      final newRefreshToken = response.data['refresh_token'] as String;
      await TokenStorage.instance.saveTokens(
        accessToken: accessToken,
        refreshToken: newRefreshToken,
      );
      completer.complete(true);
    } catch (_) {
      completer.complete(false);
    } finally {
      _refreshInFlight = null;
    }

    return completer.future;
  }
}
