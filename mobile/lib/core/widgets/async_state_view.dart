import 'package:flutter/material.dart';

/// Shared loading / error / empty scaffolding so every screen doesn't
/// reinvent the same three branches around its data.
class AsyncStateView extends StatelessWidget {
  final bool isLoading;
  final String? errorMessage;
  final bool isEmpty;
  final String emptyMessage;
  final VoidCallback? onRetry;
  final WidgetBuilder builder;

  const AsyncStateView({
    super.key,
    required this.isLoading,
    required this.errorMessage,
    required this.builder,
    this.isEmpty = false,
    this.emptyMessage = 'Nothing here yet',
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 40, color: Colors.redAccent),
              const SizedBox(height: 12),
              Text(errorMessage!, textAlign: TextAlign.center),
              if (onRetry != null) ...[
                const SizedBox(height: 16),
                OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
              ],
            ],
          ),
        ),
      );
    }

    if (isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(emptyMessage, style: TextStyle(color: Colors.grey.shade600)),
        ),
      );
    }

    return builder(context);
  }
}
