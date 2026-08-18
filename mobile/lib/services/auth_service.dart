import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import '../core/network/api_exception.dart';
import '../core/network/token_storage.dart';

class AuthService {
  final Dio _dio = ApiClient.instance.dio;

  Future<void> login({required String email, required String password}) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      await TokenStorage.instance.saveTokens(
        accessToken: response.data['access_token'] as String,
        refreshToken: response.data['refresh_token'] as String,
      );
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> logout() async {
    await TokenStorage.instance.clear();
  }

  Future<bool> hasSession() => TokenStorage.instance.hasSession;
}
