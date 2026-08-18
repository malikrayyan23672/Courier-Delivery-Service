import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:rider_app/core/network/api_exception.dart';
import 'package:rider_app/features/auth/auth_provider.dart';
import 'package:rider_app/features/auth/login_screen.dart';
import 'package:rider_app/services/auth_service.dart';

/// Never touches flutter_secure_storage or the network - overrides the two
/// methods AuthProvider calls so LoginScreen can be pumped in a plain
/// widget-test environment (no platform channels available).
class _FakeAuthService extends AuthService {
  @override
  Future<bool> hasSession() async => false;

  @override
  Future<void> login({required String email, required String password}) async {
    if (email != 'rider@example.com' || password != 'password123') {
      // Mirrors what the real AuthService throws on a 401 - an ApiException
      // whose toString() is just the message, unlike a plain Exception.
      throw ApiException('Incorrect email or password', statusCode: 401);
    }
  }
}

Future<void> _pumpLoginScreen(WidgetTester tester) async {
  await tester.pumpWidget(
    ChangeNotifierProvider(
      create: (_) => AuthProvider(_FakeAuthService()),
      child: const MaterialApp(home: LoginScreen()),
    ),
  );
  // Let AuthProvider's async bootstrap (hasSession()) resolve.
  await tester.pump();
}

void main() {
  testWidgets('renders the email/password fields and Log In button', (tester) async {
    await _pumpLoginScreen(tester);

    expect(find.text('Log In'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Email'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Password'), findsOneWidget);
  });

  testWidgets('shows validation errors when submitted empty', (tester) async {
    await _pumpLoginScreen(tester);

    await tester.tap(find.text('Log In'));
    await tester.pump();

    expect(find.text('Email is required'), findsOneWidget);
    expect(find.text('Password is required'), findsOneWidget);
  });

  testWidgets('shows a snackbar when login fails', (tester) async {
    await _pumpLoginScreen(tester);

    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'wrong@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'wrongpass');
    await tester.tap(find.text('Log In'));
    await tester.pump(); // start the submit future
    await tester.pump(); // let it resolve and rebuild
    await tester.pump(const Duration(milliseconds: 100)); // let the SnackBar animate in

    expect(find.text('Incorrect email or password'), findsOneWidget);
  });
}
