import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../../services/location_service.dart';
import '../../../services/offline_queue_service.dart';
import '../../../services/rider_service.dart';

/// Closes out the currently unlocked parcel: OTP + photo + GPS, all required -
/// spec section 23/24. The backend rejects the submission if any piece is missing,
/// so the submit button stays disabled until all three are present.
class ProofOfDeliveryScreen extends StatefulWidget {
  final String orderId;

  const ProofOfDeliveryScreen({super.key, required this.orderId});

  @override
  State<ProofOfDeliveryScreen> createState() => _ProofOfDeliveryScreenState();
}

class _ProofOfDeliveryScreenState extends State<ProofOfDeliveryScreen> {
  final _otpController = TextEditingController();
  final _recipientController = TextEditingController();
  final _noteController = TextEditingController();

  File? _photo;
  bool _sendingOtp = false;
  bool _otpSent = false;
  bool _submitting = false;
  String? _error;
  bool _errorNeedsLocationSettings = false;
  // Only ever set when the backend has no real SMS provider configured -
  // see RiderService.sendDeliveryOtp / rider.py's `dev_otp` field. Null in
  // production, where the recipient reads the code off the real SMS.
  String? _devOtp;

  @override
  void dispose() {
    _otpController.dispose();
    _recipientController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    setState(() {
      _sendingOtp = true;
      _error = null;
    });
    final riderService = context.read<RiderService>();
    try {
      final devOtp = await riderService.sendDeliveryOtp(widget.orderId);
      if (!mounted) return;
      // Mutating a TextEditingController's value triggers its own
      // notifyListeners()/rebuild - doing that from inside setState() causes
      // a reentrant rebuild while the widget tree is already mid-update,
      // which is what was throwing the "RenderBox was not laid out" /
      // sliver assertion / null-check crashes. Set it before setState, with
      // an explicit (valid) selection rather than the collapsed(-1) that
      // plain `.text =` leaves behind.
      if (devOtp != null) {
        _otpController.value = TextEditingValue(
          text: devOtp,
          selection: TextSelection.collapsed(offset: devOtp.length),
        );
      }
      setState(() {
        _otpSent = true;
        _devOtp = devOtp;
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(devOtp != null ? 'Dev mode - OTP is $devOtp (no SMS provider configured)' : 'OTP sent to recipient'),
        duration: devOtp != null ? const Duration(seconds: 6) : const Duration(seconds: 4),
      ));
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _sendingOtp = false);
    }
  }

  Future<void> _capturePhoto() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 80);
    if (picked != null) {
      setState(() => _photo = File(picked.path));
    }
  }

  bool get _canSubmit => _photo != null && _otpController.text.trim().length == 6 && !_submitting;

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
      _errorNeedsLocationSettings = false;
    });

    // Grabbed before any `await` - reading these off `context` after an
    // await risks "looking up a deactivated widget's ancestor" if the user
    // backgrounds/navigates away mid-submit.
    final locationService = context.read<LocationService>();
    final offlineQueueService = context.read<OfflineQueueService>();

    try {
      final position = await locationService.getCurrentPosition();
      final outcome = await offlineQueueService.submitProofOfDelivery(
            orderId: widget.orderId,
            photo: _photo!,
            otpCode: _otpController.text.trim(),
            lat: position.latitude,
            lng: position.longitude,
            recipientName: _recipientController.text.trim(),
            note: _noteController.text.trim(),
          );
      if (mounted) {
        // Pop once, with the outcome - the caller (delivery detail screen)
        // reloads and shows its own delivered/proof-of-delivery confirmation
        // instead of this screen popping straight past it back to the list.
        Navigator.of(context).pop(outcome);
      }
    } on LocationPermissionException catch (e) {
      setState(() {
        _error = e.message;
        _errorNeedsLocationSettings = e.isPermanentlyDenied;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Complete Delivery')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_error!, style: const TextStyle(color: AppColors.danger)),
                  if (_errorNeedsLocationSettings) ...[
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: () => context.read<LocationService>().openLocationSettings(),
                      style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.danger)),
                      child: const Text('Open Settings', style: TextStyle(color: AppColors.danger)),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          const Text('1. Recipient OTP', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (_devOtp != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.warning.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Dev mode - no SMS provider configured. OTP: $_devOtp',
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.warning),
              ),
            ),
            const SizedBox(height: 8),
          ],
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(labelText: '6-digit OTP', counterText: ''),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                onPressed: _sendingOtp ? null : _sendOtp,
                child: Text(_sendingOtp ? '...' : (_otpSent ? 'Resend' : 'Send OTP')),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text('2. Delivery Photo', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _capturePhoto,
            child: Container(
              height: 180,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.grey.shade200,
                borderRadius: BorderRadius.circular(12),
              ),
              child: _photo == null
                  ? Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.camera_alt_outlined, color: Colors.grey.shade600, size: 32),
                        const SizedBox(height: 8),
                        Text('Tap to take a photo', style: TextStyle(color: Colors.grey.shade600)),
                      ],
                    )
                  : ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.file(_photo!, fit: BoxFit.cover),
                    ),
            ),
          ),
          const SizedBox(height: 20),
          const Text('3. Recipient Name (optional)', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(controller: _recipientController, decoration: const InputDecoration(labelText: 'Recipient name')),
          const SizedBox(height: 16),
          TextField(
            controller: _noteController,
            decoration: const InputDecoration(labelText: 'Notes (optional)'),
            maxLines: 2,
          ),
          const SizedBox(height: 28),
          ElevatedButton(
            onPressed: _canSubmit ? _submit : null,
            child: _submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                  )
                : const Text('Complete Delivery'),
          ),
        ],
      ),
    );
  }
}
