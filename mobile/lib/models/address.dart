class Address {
  final String? label;
  final String fullAddress;
  final String? city;
  final String? contactName;
  final String? contactPhone;

  Address({
    this.label,
    required this.fullAddress,
    this.city,
    this.contactName,
    this.contactPhone,
  });

  factory Address.fromJson(Map<String, dynamic> json) {
    return Address(
      label: json['label'] as String?,
      fullAddress: json['full_address'] as String? ?? '',
      city: json['city'] as String?,
      contactName: json['contact_name'] as String?,
      contactPhone: json['contact_phone'] as String?,
    );
  }
}
