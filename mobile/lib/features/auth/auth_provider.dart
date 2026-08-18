import 'package:flutter/foundation.dart';

import '../../core/network/api_client.dart';
import '../../services/auth_service.dart';

enum SessionStatus { checking, authenticated, unauthenticated }

/// Root of the auth state tree. The app shell listens to [status] to decide
/// whether to show the login screen or the rider shell, and re-checks it
/// whenever [ApiClient] reports the refresh token itself has expired.
class AuthProvider extends ChangeNotifier {
  AuthProvider(this._authService) {
    ApiClient.instance.onSessionExpired = _handleSessionExpired;
    _bootstrap();
  }

  final AuthService _authService;

  SessionStatus status = SessionStatus.checking;
  bool isSubmitting = false;
  String? errorMessage;

  Future<void> _bootstrap() async {
    final hasSession = await _authService.hasSession();
    status = hasSession ? SessionStatus.authenticated : SessionStatus.unauthenticated;
    notifyListeners();
  }

  Future<bool> login({required String email, required String password}) async {
    isSubmitting = true;
    errorMessage = null;
    notifyListeners();

    try {
      await _authService.login(email: email, password: password);
      status = SessionStatus.authenticated;
      return true;
    } catch (e) {
      errorMessage = e.toString();
      return false;
    } finally {
      isSubmitting = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    status = SessionStatus.unauthenticated;
    notifyListeners();
  }

  void _handleSessionExpired() {
    status = SessionStatus.unauthenticated;
    errorMessage = 'Your session expired. Please log in again.';
    notifyListeners();
  }
}
