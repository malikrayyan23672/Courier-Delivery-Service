import 'address.dart';
import 'payment.dart';
import 'tracking_event.dart';

/// Mirrors backend/app/models/order.py OrderStatus. Kept as a plain string
/// wrapper (not a Dart enum) so an unrecognized future status from the server
/// doesn't crash the app - it just won't match any of the named constants.
class OrderStatus {
  static const created = 'created';
  static const assigned = 'assigned';
  static const pickedUp = 'picked_up';
  static const inHub = 'in_hub';
  static const inTransit = 'in_transit';
  static const destHub = 'dest_hub';
  static const outForDelivery = 'out_for_delivery';
  static const delivered = 'delivered';
  static const failed = 'failed';
  static const rto = 'rto';
  static const cancelled = 'cancelled';

  /// Statuses where this order is still something the rider needs to act on.
  static const active = [assigned, pickedUp, inHub, inTransit, destHub, outForDelivery];
}

class Order {
  final String id;
  final String trackingNumber;
  final String status;
  final String bookingChannel;
  final Address? pickupAddress;
  final Address? dropoffAddress;
  final double? packageWeightKg;
  final String? packageDescription;
  final double? estimatedPrice;
  final double? finalPrice;
  final bool? riderAccepted;
  final DateTime? createdAt;
  final String? proofOfDeliveryUrl;
  final String? proofOfDeliveryRecipientName;

  // Detail-only fields (populated via GET /rider/deliveries/{id})
  final List<TrackingEvent> trackingEvents;
  final Payment? payment;

  Order({
    required this.id,
    required this.trackingNumber,
    required this.status,
    required this.bookingChannel,
    this.pickupAddress,
    this.dropoffAddress,
    this.packageWeightKg,
    this.packageDescription,
    this.estimatedPrice,
    this.finalPrice,
    this.riderAccepted,
    this.createdAt,
    this.proofOfDeliveryUrl,
    this.proofOfDeliveryRecipientName,
    this.trackingEvents = const [],
    this.payment,
  });

  /// True if this order is a pickup offer the rider hasn't responded to yet.
  bool get isPendingOffer =>
      (status == OrderStatus.assigned || status == OrderStatus.destHub) && riderAccepted != true;

  /// The COD amount to collect on this delivery, if any.
  double? get codAmount => payment != null && payment!.isCod ? payment!.amount : null;

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'] as String,
      trackingNumber: json['tracking_number'] as String? ?? '',
      status: json['status'] as String? ?? OrderStatus.created,
      bookingChannel: json['booking_channel'] as String? ?? '',
      pickupAddress: json['pickup_address'] != null ? Address.fromJson(json['pickup_address']) : null,
      dropoffAddress: json['dropoff_address'] != null ? Address.fromJson(json['dropoff_address']) : null,
      packageWeightKg: (json['package_weight_kg'] as num?)?.toDouble(),
      packageDescription: json['package_description'] as String?,
      estimatedPrice: (json['estimated_price'] as num?)?.toDouble(),
      finalPrice: (json['final_price'] as num?)?.toDouble(),
      riderAccepted: json['rider_accepted'] as bool?,
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at'] as String) : null,
      proofOfDeliveryUrl: json['proof_of_delivery_url'] as String?,
      proofOfDeliveryRecipientName: json['proof_of_delivery_recipient_name'] as String?,
      trackingEvents: json['tracking_events'] != null
          ? (json['tracking_events'] as List).map((e) => TrackingEvent.fromJson(e)).toList()
          : const [],
      payment: json['payment'] != null ? Payment.fromJson(json['payment']) : null,
    );
  }
}
