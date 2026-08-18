import 'dart:io';

import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import '../core/network/api_exception.dart';
import '../models/order.dart';
import '../models/rider_profile.dart';
import '../models/status_request.dart';
import '../models/parcel_unlock_request.dart';
import '../models/manifest_item.dart';
import '../models/support_ticket.dart';
import '../models/earnings.dart';
import '../models/notification.dart';

class RiderService {
  final Dio _dio = ApiClient.instance.dio;

  Future<RiderProfile> getMe() async {
    try {
      final response = await _dio.get('/rider/me');
      return RiderProfile.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  /// Requests an availability change - this does NOT flip is_available itself;
  /// a staff/admin approver must approve the request first (see
  /// getAvailabilityRequests / the AvailabilityRequestsScreen history).
  Future<StatusRequest> requestAvailabilityChange(bool isAvailable, {String? note}) async {
    try {
      final response = await _dio.post('/rider/availability-requests', data: {
        'requested_is_available': isAvailable,
        if (note != null) 'note': note,
      });
      return StatusRequest.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<StatusRequest>> getAvailabilityRequests() async {
    try {
      final response = await _dio.get('/rider/availability-requests');
      return (response.data as List).map((e) => StatusRequest.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> updateLocation({required double lat, required double lng}) async {
    try {
      await _dio.patch('/rider/location', data: {'lat': lat, 'lng': lng});
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<Order>> getDeliveries() async {
    try {
      final response = await _dio.get('/rider/deliveries');
      return (response.data as List).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Order> getDeliveryDetail(String orderId) async {
    try {
      final response = await _dio.get('/rider/deliveries/$orderId');
      return Order.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  /// Unassigned parcels in the rider's zone available for self-claim, sorted
  /// by distance from the rider's last known location where possible.
  Future<List<Order>> getNearbyParcels() async {
    try {
      final response = await _dio.get('/rider/parcels/nearby');
      return (response.data as List).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Order> lockParcel(String orderId) async {
    try {
      final response = await _dio.post('/rider/parcels/$orderId/lock');
      return Order.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  /// Requests to be released from an already-accepted delivery - needs
  /// staff/admin approval before the parcel actually unlocks.
  Future<void> requestParcelUnlock(String orderId, {String? reason}) async {
    try {
      await _dio.post('/rider/deliveries/$orderId/unlock-requests', data: {
        if (reason != null) 'reason': reason,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<ParcelUnlockRequest>> getUnlockRequests(String orderId) async {
    try {
      final response = await _dio.get('/rider/deliveries/$orderId/unlock-requests');
      return (response.data as List).map((e) => ParcelUnlockRequest.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  /// Crates arrived at a hub and assigned to this rider for last-mile
  /// delivery, ready to be scanned as picked up.
  Future<List<ManifestItem>> getArrivedManifestItems() async {
    try {
      final response = await _dio.get('/rider/manifest-items/arrived');
      return (response.data as List).map((e) => ManifestItem.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<ManifestItem> scanManifestItemPickup(String itemId) async {
    try {
      final response = await _dio.post('/rider/manifest-items/$itemId/scan-pickup');
      return ManifestItem.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Order> returnToHub(String orderId, {double? lat, double? lng}) async {
    try {
      final response = await _dio.post('/rider/deliveries/$orderId/return-to-hub', data: {
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
      });
      return Order.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<SupportTicket> createSupportTicket({required String subject, required String message, String? orderId}) async {
    try {
      final response = await _dio.post('/rider/support-tickets', data: {
        'subject': subject,
        'message': message,
        if (orderId != null) 'order_id': orderId,
      });
      return SupportTicket.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<SupportTicket>> getSupportTickets() async {
    try {
      final response = await _dio.get('/rider/support-tickets');
      return (response.data as List).map((e) => SupportTicket.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<SupportTicket> getSupportTicketDetail(String ticketId) async {
    try {
      final response = await _dio.get('/rider/support-tickets/$ticketId');
      return SupportTicket.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<SupportTicket> replyToSupportTicket(String ticketId, String body) async {
    try {
      final response = await _dio.post('/rider/support-tickets/$ticketId/messages', data: {'body': body});
      return SupportTicket.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<EarningsBreakdown> getEarnings({int days = 7}) async {
    try {
      final response = await _dio.get('/rider/earnings', queryParameters: {'days': days});
      return EarningsBreakdown.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> respondToOffer(String orderId, {required bool accept}) async {
    try {
      await _dio.patch('/rider/deliveries/$orderId/respond', data: {'accept': accept});
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  /// [newStatus] must be one of the rider-settable statuses: picked_up, out_for_delivery, failed.
  Future<void> updateDeliveryStatus(
    String orderId, {
    required String newStatus,
    String? note,
    double? lat,
    double? lng,
  }) async {
    try {
      await _dio.patch(
        '/rider/deliveries/$orderId/status',
        queryParameters: {
          'new_status': newStatus,
          if (note != null) 'note': note,
          if (lat != null) 'lat': lat,
          if (lng != null) 'lng': lng,
        },
      );
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> sendDeliveryOtp(String orderId) async {
    try {
      await _dio.post('/rider/deliveries/$orderId/send-delivery-otp');
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Order> submitProofOfDelivery(
    String orderId, {
    required File photo,
    required String otpCode,
    required double lat,
    required double lng,
    String? recipientName,
    String? note,
  }) async {
    try {
      final formData = FormData.fromMap({
        'photo': await MultipartFile.fromFile(photo.path, filename: 'pod_$orderId.jpg'),
        'otp_code': otpCode,
        'lat': lat,
        'lng': lng,
        if (recipientName != null && recipientName.isNotEmpty) 'recipient_name': recipientName,
        if (note != null && note.isNotEmpty) 'note': note,
      });
      final response = await _dio.post('/rider/deliveries/$orderId/proof-of-delivery', data: formData);
      return Order.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<AppNotification>> getNotifications() async {
    try {
      final response = await _dio.get('/rider/notifications');
      return (response.data as List).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> markNotificationRead(String notificationId) async {
    try {
      await _dio.patch('/rider/notifications/$notificationId/read');
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}
