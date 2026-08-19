/// Failure reasons a rider can pick when a doorstep delivery fails, shared
/// between the quick attempts-1-2 dialog (delivery_detail_screen.dart) and
/// the mandatory-photo final screen (delivery_failed_final_screen.dart).
///
/// Each label maps to a backend reason slug (see rider.py's
/// FAILURE_REASONS). "Customer refused" -> `refused` is an immediate RTO
/// trigger regardless of attempt count, same as exhausting all 3 attempts.
const Map<String, String> failureReasons = {
  'Customer unavailable': 'unavailable',
  'Customer refused': 'refused',
  'Customer unreachable': 'unreachable',
  'Customer requested reschedule': 'reschedule_requested',
  'Incorrect address': 'bad_address',
  'Address inaccessible': 'inaccessible',
  'Safety issue': 'safety',
  'Other': 'other',
};

const String refusedReasonLabel = 'Customer refused';
const String refusedReasonSlug = 'refused';

String failureReasonSlug(String label) => failureReasons[label] ?? 'other';
