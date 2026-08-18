import 'package:dio/dio.dart';

/// A normalized, human-readable error surfaced to the UI. FastAPI errors show up as
/// either `{"detail": "message"}` or `{"detail": [{"msg": "...", ...}, ...]}` (pydantic
/// validation errors) - this collapses both into one string.
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  factory ApiException.fromDioError(DioException error) {
    final response = error.response;
    if (response == null) {
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout) {
        return ApiException('The connection timed out. Check your internet and try again.');
      }
      if (error.type == DioExceptionType.connectionError) {
        return ApiException('Could not reach the server. Check your connection.');
      }
      return ApiException(error.message ?? 'Something went wrong. Please try again.');
    }

    final data = response.data;
    String message = 'Something went wrong. Please try again.';

    if (data is Map && data['detail'] != null) {
      final detail = data['detail'];
      if (detail is String) {
        message = detail;
      } else if (detail is List && detail.isNotEmpty) {
        message = detail
            .map((e) => e is Map && e['msg'] != null ? e['msg'].toString() : e.toString())
            .join('\n');
      }
    }

    return ApiException(message, statusCode: response.statusCode);
  }

  @override
  String toString() => message;
}
