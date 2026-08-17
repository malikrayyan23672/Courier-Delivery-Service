// All parcels for the logged-in customer's phone number, plus a rule-based
// status summary. This is the canonical /customer/dashboard route from the
// TRD; the implementation lives in /dashboard, re-exported here so both
// URLs resolve to one implementation.
export { default } from '../../dashboard/page';
