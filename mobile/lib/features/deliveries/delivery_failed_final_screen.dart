import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import 'delivery_detail_provider.dart';

const _failureReasons = [
  'Customer unavailable',
  'Customer refused',
  'Customer unreachable',
  'Customer requested reschedule',
  'Incorrect address',
  'Address inaccessible',
  'Safety issue',
  'Other',
];

/// The 3rd/final failed-delivery attempt: this auto-returns the parcel to
/// origin, so - unlike attempts 1-2 (see the quick dialog in
/// delivery_detail_screen.dart) - a cancellation photo is mandatory. Mirrors
/// pod/proof_of_delivery_screen.dart's layout.
class DeliveryFailedFinalScreen extends StatefulWidget {
  const DeliveryFailedFinalScreen({super.key});

  @override
  State<DeliveryFailedFinalScreen> createState() => _DeliveryFailedFinalScreenState();
}

class _DeliveryFailedFinalScreenState extends State<DeliveryFailedFinalScreen> {
  final _noteController = TextEditingController();
  String? _reason;
  File? _photo;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _capturePhoto() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 80);
    if (picked != null) {
      setState(() => _photo = File(picked.path));
    }
  }

  bool get _canSubmit => _photo != null && _reason != null && !_submitting;

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    final note = _noteController.text.trim().isEmpty ? _reason! : '$_reason - ${_noteController.text.trim()}';

    try {
      final result = await context.read<DeliveryDetailProvider>().markFailed(reason: note, photo: _photo);
      if (!mounted) return;
      if (result == ActionResult.failed) {
        setState(() => _error = context.read<DeliveryDetailProvider>().actionError ?? 'Failed to submit');
        return;
      }
      final message = result == ActionResult.queued
          ? 'No connection - saved and will sync automatically'
          : 'Parcel marked for return to origin';
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Final Attempt - Return to Origin')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warning.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Text(
              'This is the 3rd failed attempt. Submitting this will return the parcel to origin - a photo is required as proof.',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ),
          ],
          const SizedBox(height: 20),
          const Text('1. Reason', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: _reason,
            decoration: const InputDecoration(labelText: 'Reason'),
            items: _failureReasons.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
            onChanged: (value) => setState(() => _reason = value),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _noteController,
            decoration: const InputDecoration(labelText: 'Notes (optional)'),
            maxLines: 2,
          ),
          const SizedBox(height: 20),
          const Text('2. Proof Photo (required)', style: TextStyle(fontWeight: FontWeight.w700)),
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
          const SizedBox(height: 28),
          ElevatedButton(
            onPressed: _canSubmit ? _submit : null,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            child: _submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                  )
                : const Text('Return Parcel to Origin'),
          ),
        ],
      ),
    );
  }
}
