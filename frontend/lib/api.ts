import { json } from "stream/consumers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

/** Resolves an uploaded file's path (e.g. product photos, POD photos) against the API origin - they're served by the backend, not the frontend, and aren't under /api/v1. Absolute URLs (a seller-pasted image link) pass through untouched. */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

const ACCESS_TOKEN_KEY = 'raftaarexpress_access_token';
const REFRESH_TOKEN_KEY = 'raftaarexpress_refresh_token';

function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  window.dispatchEvent(new CustomEvent('auth:tokens-updated', { detail: { accessToken } }));
}

export function clearStoredTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event('auth:logout'));
}

// De-dupe concurrent refresh attempts if several requests 401 at the same time.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        storeTokens(data.access_token, data.refresh_token);
        return data.access_token as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    // FastAPI validation errors return detail as an array of {msg, loc} objects
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).join(', ')
      : typeof detail === 'string'
        ? detail
        : 'Something went wrong';
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  _isRetry = false
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  // Access token expired mid-session: try a silent refresh and replay the request once.
  if (res.status === 401 && token && !_isRetry && !path.startsWith('/auth/')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, newToken, true);
    }
    clearStoredTokens();
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = 'Request failed';
    }
    throw new ApiError(res.status, (body as { detail?: unknown })?.detail ?? body);
  }

  // Some endpoints (e.g. health) may return no content
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// ---- Auth ----

export interface RegisterPayload {
  full_name: string;
  email: string;
  phone: string;
  cnic: string;
  password: string;
}

export interface RegisterBusinessPayload{
  full_name: string;
  email: string;
  phone: string;
  cnic: string;
  cnic_photo_url?: string;
  password: string;
  business_name: string;
  business_type: string;
  business_registration_number: string;
  ntn: string; //national tax number -> optional
  estimated_monthly_shipments: string;
  business_address: string;
  pickup_address: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  preffered_pickup_time: string;
  cod_service: boolean;
  bank_name: string;
  account_title: string;
  account_number: string;


}

export function registerBusinessUser(payload: RegisterBusinessPayload){
  return request<{message: string; user_id: string}>('/auth/business/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function uploadCnicPhoto(file: File) {
  const form = new FormData();
  form.append('image', file);
  return request<{ url: string }>('/auth/upload-cnic', { method: 'POST', body: form });
}

export function registerUser(payload: RegisterPayload) {
  return request<{ message: string; user_id: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sendOtp(phone: string) {
  return request<{ message: string }>('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export function verifyOtp(phone: string, otp_code: string) {
  return request<{ message: string }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp_code }),
  });
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export function loginUser(email: string, password: string) {
  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ---- Customer orders ----

export interface AddressInput {
  label?: string;
  full_address: string;
  city?: string;
  contact_name?: string;
  contact_phone?: string;
}

export interface OrderCreatePayload {
  pickup_address: AddressInput;
  dropoff_address: AddressInput;
  package_weight_kg?: number;
  package_size?: string | null;
  package_description?: string;
  discount_code?: string | null;
}

export interface AddressOut {
  label?: string | null;
  full_address: string;
  city?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
}

export interface Order {
  id: string;
  tracking_number: string;
  status: string;
  booking_channel: string;
  pickup_address?: AddressOut | null;
  dropoff_address?: AddressOut | null;
  package_weight_kg?: number | null;
  package_description?: string | null;
  estimated_price?: number;
  final_price?: number;
  discount_id?: string | null;
  discount_amount?: number | null;
  rider_accepted?: boolean | null;
  created_at?: string;
}

export function bookOrder(payload: OrderCreatePayload, token: string) {
  return request<Order>('/customer/orders', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function listMyOrders(token: string) {
  return request<Order[]>('/customer/orders', { method: 'GET' }, token);
}

export interface OrderTrackingEvent {
  status: string;
  note: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at?: string;
}

export interface PaymentInfo {
  amount: number;
  method: string;
  status: string;
  gateway_reference?: string | null;
}

export interface RiderContact {
  full_name: string;
  phone: string;
  vehicle_type?: string | null;
  rating: number;
  current_lat?: number | null;
  current_lng?: number | null;
}

export interface OrderDetail extends Order {
  tracking_events: OrderTrackingEvent[];
  payment?: PaymentInfo | null;
  rider?: RiderContact | null;
}

export function getMyOrder(orderId: string, token: string) {
  return request<OrderDetail>(`/customer/orders/${orderId}`, { method: 'GET' }, token);
}

// ---- Customer profile ----

export interface MyProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface BranchDetails{
  id: string;
  name: string;
  address: string;
  manager_id: string;
  phone: string;
  email: string;
  latitude: string | null;
  logitude: string | null;
}

export function getMyProfile(token: string) {
  return request<MyProfile>('/customer/me', { method: 'GET' }, token);
}

// ---- Staff (walk-in booking) ----

export interface StaffOrderPayload extends OrderCreatePayload {
  customer_id?: string;
  guest_full_name?: string;
  guest_phone?: string;
  guest_email?: string;
  payment_method: 'cash' | 'card' | 'online_gateway' | 'wallet';
}

export function bookStaffOrder(payload: StaffOrderPayload, token: string) {
  return request<Order>('/staff/orders', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function getBranchDetails(token: string){
  return request<BranchDetails>('/manager/branch/location', {method: 'GET'}, token);
}

export function getManagerProfile(token: string){
  return request<ManagerProfile>('/manager/me', {method: 'GET'}, token);
}

export function listStaffOrders(token: string) {
  return request<Order[]>('/staff/orders', { method: 'GET' }, token);
}

export interface ManagerProfile{
  manager_id: string;
  full_name: string;
  phone: string;

}

export interface StaffRider {
  rider_id: string;
  full_name: string;
  phone: string;
  vehicle_type: string | null;
  is_available: boolean;
  rating: number;
}

export function listStaffRiders(token: string) {
  return request<StaffRider[]>('/staff/riders', { method: 'GET' }, token);
}

export function staffAssignRider(orderId: string, riderId: string, token: string) {
  return request<{ message: string }>(
    `/staff/orders/${orderId}/assign-rider/${riderId}`,
    { method: 'PATCH' },
    token
  );
}

export function deleteUserbyAdmin(user_id: string, token: string){
  return request<{message: string}>(
    `/admin/users/delete/${user_id}`, {method: 'DELETE'}, token
  )
}

export function deleteZoneByAdmin(zone_id: string, token: string){
  return request<{message: string}>(
    `/admin/zone/delete/${zone_id}`, {method: 'DELETE'}, token
  )
}

// ---- Rider ----

export interface RiderStats {
  deliveries_today: number;
  active_deliveries: number;
  earnings_today: number;
}

export interface RiderMe {
  full_name: string;
  vehicle_type: string | null;
  status: string;
  is_available: boolean;
  rating: number;
  stats: RiderStats;
  cod_cash_held: number;
  cod_wallet_locked: boolean;
  cod_wallet_limit: number;
  cod_wallet_warning_at: number;
}

export function getRiderProfile(token: string) {
  return request<RiderMe>('/rider/me', { method: 'GET' }, token);
}

export function updateRiderAvailability(isAvailable: boolean, token: string) {
  return request<{ is_available: boolean }>(
    '/rider/availability',
    { method: 'PATCH', body: JSON.stringify({ is_available: isAvailable }) },
    token
  );
}

export function updateRiderLocation(lat: number, lng: number, token: string) {
  return request<{ lat: number; lng: number }>(
    '/rider/location',
    { method: 'PATCH', body: JSON.stringify({ lat, lng }) },
    token
  );
}

export function listMyDeliveries(token: string) {
  return request<Order[]>('/rider/deliveries', { method: 'GET' }, token);
}

export function respondToDelivery(orderId: string, accept: boolean, token: string) {
  return request<{ message: string }>(
    `/rider/deliveries/${orderId}/respond`,
    { method: 'PATCH', body: JSON.stringify({ accept }) },
    token
  );
}

export function updateDeliveryStatus(
  orderId: string,
  newStatus: string,
  note: string | undefined,
  token: string,
  coords?: { lat: number; lng: number }
) {
  const params = new URLSearchParams({
    new_status: newStatus,
    ...(note ? { note } : {}),
    ...(coords ? { lat: String(coords.lat), lng: String(coords.lng) } : {}),
  });
  return request<{ message: string; status: string }>(
    `/rider/deliveries/${orderId}/status?${params.toString()}`,
    { method: 'PATCH' },
    token
  );
}

export function sendDeliveryOtp(orderId: string, token: string) {
  return request<{ message: string; expires_in_minutes: number }>(
    `/rider/deliveries/${orderId}/send-delivery-otp`,
    { method: 'POST' },
    token
  );
}

export function submitProofOfDelivery(
  orderId: string,
  payload: { photo: File; otpCode: string; lat: number; lng: number; recipientName?: string; note?: string },
  token: string
) {
  const form = new FormData();
  form.append('photo', payload.photo);
  form.append('otp_code', payload.otpCode);
  form.append('lat', String(payload.lat));
  form.append('lng', String(payload.lng));
  if (payload.recipientName) form.append('recipient_name', payload.recipientName);
  if (payload.note) form.append('note', payload.note);
  return request<Order>(`/rider/deliveries/${orderId}/proof-of-delivery`, { method: 'POST', body: form }, token);
}

// ---- Admin ----

export function listAllOrders(token: string) {
  return request<Order[]>('/admin/orders', { method: 'GET' }, token);
}

export interface AdminRider {
  rider_id: string;
  full_name: string;
  phone: string;
  vehicle_type: string | null;
  is_available: boolean;
  rating: number;
}

export interface RiderCard{
  name: string;
  vehicle: string;
  status: "online" | "busy" | "offline";
  score: number;
  success: number;
  deliveries: number;
  gps: string;
}

export function listRiders(token: string) {
  return request<AdminRider[]>('/admin/riders', { method: 'GET' }, token);
}

export function assignRider(orderId: string, riderId: string, token: string) {
  return request<{ message: string }>(
    `/admin/orders/${orderId}/assign-rider/${riderId}`,
    { method: 'PATCH' },
    token
  );
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  cnic: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface StaffProfile{
  id: string;
  user_id: string;
  employee_code: string;
  branch_name: string;
  branch_location: string;
  branch_id: string;
  designation: string

}

export interface Zone{
  id: string;
  name: string;
  description: string;
  is_active: boolean

}

export interface ZoneCreatePayload{
  name: string;
  description: string;
  is_active: boolean
}

export interface Branch{
  id: string;
  name: string;
  address: string;
  manager_id: string;
  phone: string;
  email: string;
  latitude: string;
  longitude: string;
  opening_time: string;
  closing_time: string;
  status: string;
  zone_id: string;

}

export function listStaffAndRiders(token: string) {
  return request<AdminUser[]>('/admin/users', { method: 'GET' }, token);
}

export function listZones(token: string){

  return request<Zone[]>('/admin/zones', {method: 'GET'}, token);
}

export function listBranches(token: string){
  return request<Branch[]>('/admin/branches', {method: 'GET'}, token);
}

export interface AdminCreateUserPayload {
  full_name: string;
  email: string;
  phone: string;
  cnic: string;
  password: string;
  role: 'staff' | 'rider' | 'admin' | 'customer';
  designation: string;
  zone_id: string;
  branch_id: string
}

export function addNewZone(payload: ZoneCreatePayload, token: string){
  return request<Zone>('/admin/zones', {method: 'POST', body: JSON.stringify(payload)}, token);
}

export function createStaffOrRider(payload: AdminCreateUserPayload, token: string) {
  return request<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export interface AdminAnalytics {
  total_orders: number;
  total_revenue: number;
  status_counts: Record<string, number>;
  channel_counts: Record<string, number>;
  daily_last_7_days: { date: string; orders: number; revenue: number }[];
  top_riders: { full_name: string; deliveries: number; earnings: number }[];
  rto_rate: number;
  cod_collected_total: number;
  cod_pending_total: number;
  avg_delivery_hours: number | null;
}

export function getAdminAnalytics(token: string) {
  return request<AdminAnalytics>('/admin/analytics', { method: 'GET' }, token);
}

// ---- Public tracking ----

export interface TrackingEvent {
  status: string;
  note: string | null;
  timestamp: string;
}

export interface TrackingResult {
  tracking_number: string;
  status: string;
  history: TrackingEvent[];
}

export function trackOrder(trackingNumber: string) {
  return request<TrackingResult>(`/tracking/${trackingNumber}`);
}

// ---- COD Settlements (Layer 1: T+1 payout) ----

export interface Settlement {
  id: string;
  order_id: string;
  business_id: string | null;
  company_name: string | null;
  tracking_number: string | null;
  amount: number;
  settle_due_on: string | null;
  status: string;
  settled_at: string | null;
  remark: string | null;
  created_at: string | null;
}

export function listSettlements(token: string, statusFilter?: string) {
  return request<Settlement[]>(
    `/admin/settlements${statusFilter ? `?status_filter=${statusFilter}` : ''}`,
    { method: 'GET' },
    token
  );
}

export function getSettlementSummary(token: string) {
  return request<{ pending_count: number; pending_amount: number }>(
    '/admin/settlements/summary',
    { method: 'GET' },
    token
  );
}

export function settleT1(token: string, remark?: string) {
  return request<{ settled: Settlement[]; blocked: Settlement[] }>(
    `/admin/settlements/settle-t1${remark ? `?remark=${encodeURIComponent(remark)}` : ''}`,
    { method: 'POST' },
    token
  );
}

export function settleOne(settlementId: string, token: string) {
  return request<Settlement>(`/admin/settlements/${settlementId}/settle`, { method: 'POST' }, token);
}

// ---- Seller Wallets (Layer 6: auto-lock + reconciliation) ----

export interface Wallet {
  id: string;
  company_name: string;
  email: string | null;
  wallet_balance: number;
  wallet_locked: boolean;
  wallet_lock_reason: string | null;
  status: string | null;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  balance_after: number | null;
  transaction_type: string | null;
  reference: string | null;
  created_at: string | null;
}

export interface Reconciliation {
  id: string;
  business_id: string;
  expected_amount: number;
  actual_amount: number;
  difference: number;
  status: string;
  notes: string | null;
  created_at: string | null;
}

export function listWallets(token: string) {
  return request<Wallet[]>('/admin/wallets', { method: 'GET' }, token);
}

export function setWalletLock(businessId: string, lock: boolean, reason: string | undefined, token: string) {
  return request<Wallet>(
    `/admin/wallets/${businessId}/lock`,
    { method: 'PATCH', body: JSON.stringify({ lock, reason }) },
    token
  );
}

export function listWalletTransactions(businessId: string, token: string) {
  return request<WalletTransaction[]>(`/admin/wallets/${businessId}/transactions`, { method: 'GET' }, token);
}

export function reconcileWallet(
  businessId: string,
  expected_amount: number,
  actual_amount: number,
  notes: string | undefined,
  token: string
) {
  return request<Reconciliation>(
    `/admin/wallets/${businessId}/reconcile`,
    { method: 'POST', body: JSON.stringify({ expected_amount, actual_amount, notes }) },
    token
  );
}

export function listReconciliations(businessId: string, token: string) {
  return request<Reconciliation[]>(`/admin/wallets/${businessId}/reconciliations`, { method: 'GET' }, token);
}

// ---- Bus Network (Layer 1) ----

export interface BusOperator {
  id: string;
  name: string;
  city: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
}

export type BusOperatorCreate = Omit<BusOperator, 'id' | 'city' | 'contact_phone' | 'contact_email' | 'status'> & {
  city?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  status?: string;
};

export interface BusSchedule {
  id: string;
  operator_id: string;
  operator_name: string | null;
  origin_city: string;
  destination_city: string;
  origin_branch_id: string | null;
  destination_branch_id: string | null;
  departure_time: string | null;
  departure_interval_min: number | null;
  fare: number | null;
  status: string | null;
}

export type BusScheduleCreate = Omit<BusSchedule, 'id' | 'operator_name' | 'origin_branch_id' | 'destination_branch_id'> & {
  origin_branch_id?: string | null;
  destination_branch_id?: string | null;
};

export interface ManifestItem {
  id: string;
  order_id: string | null;
  crate_label: string | null;
  scan_status: string | null;
  scanned_at: string | null;
  tracking_number: string | null;
}

export interface BusManifest {
  id: string;
  manifest_number: string | null;
  coach_number: string | null;
  departure_at: string | null;
  origin_city: string | null;
  destination_city: string | null;
  status: string | null;
  operator_name: string | null;
  items: ManifestItem[];
}

export function listBusOperators(token: string) {
  return request<BusOperator[]>('/admin/bus/operators', { method: 'GET' }, token);
}

export function createBusOperator(payload: BusOperatorCreate, token: string) {
  return request<BusOperator>('/admin/bus/operators', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function listBusSchedules(token: string) {
  return request<BusSchedule[]>('/admin/bus/schedules', { method: 'GET' }, token);
}

export function createBusSchedule(
  payload: BusScheduleCreate,
  token: string
) {
  return request<BusSchedule>('/admin/bus/schedules', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function listBusManifests(token: string) {
  return request<BusManifest[]>('/admin/bus/manifests', { method: 'GET' }, token);
}

export function createBusManifest(
  payload: {
    schedule_id?: string;
    manifest_number?: string;
    coach_number?: string;
    departure_at?: string;
    origin_city?: string;
    destination_city?: string;
  },
  token: string
) {
  return request<BusManifest>('/admin/bus/manifests', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function addManifestItem(manifestId: string, orderId: string | undefined, crateLabel: string | undefined, token: string) {
  const params = new URLSearchParams();
  if (orderId) params.set('order_id', orderId);
  if (crateLabel) params.set('crate_label', crateLabel);
  return request<BusManifest>(
    `/admin/bus/manifests/${manifestId}/items?${params.toString()}`,
    { method: 'POST' },
    token
  );
}

export function getPublicManifest(manifestId: string) {
  return request<BusManifest>(`/bus/manifests/${manifestId}`, { method: 'GET' });
}

export function updateManifestStatus(
  manifestId: string,
  status: string,
  itemStatus: string | undefined,
  token: string,
  scannedItemIds?: string[]
) {
  return request<BusManifest>(
    `/admin/bus/manifests/${manifestId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status, item_status: itemStatus, scanned_item_ids: scannedItemIds }) },
    token
  );
}

// ---- RNP Network (Layer 3) ----

export interface RNP {
  id: string;
  shop_name: string;
  owner_name: string | null;
  phone: string;
  city: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  status: string;
  created_at: string | null;
}

export function listRNP(token: string, statusFilter?: string) {
  return request<RNP[]>(
    `/admin/rnp${statusFilter ? `?status_filter=${statusFilter}` : ''}`,
    { method: 'GET' },
    token
  );
}

export function setRNPStatus(rnpId: string, status: string, token: string) {
  return request<RNP>(`/admin/rnp/${rnpId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token);
}

// ---- Discounts (Layer 6) ----

export interface Discount {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  discount_type: string;
  value: number;
  max_discount_amount: number | null;
  min_order_value: number | null;
  requires_login: boolean;
  is_auto_applied: boolean;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  expires_at: string | null;
}

export type DiscountCreate = Omit<Discount, 'id' | 'uses_count' | 'code' | 'description' | 'max_discount_amount' | 'min_order_value' | 'max_uses' | 'expires_at'> & {
  code?: string | null;
  description?: string | null;
  max_discount_amount?: number | null;
  min_order_value?: number | null;
  max_uses?: number | null;
  expires_at?: string | null;
};

export function listDiscounts(token: string) {
  return request<Discount[]>('/discounts', { method: 'GET' }, token);
}

export function createDiscount(payload: DiscountCreate, token: string) {
  return request<Discount>('/discounts', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function toggleDiscount(discountId: string, isActive: boolean, token: string) {
  return request<Discount>(`/discounts/${discountId}/toggle?is_active=${isActive}`, { method: 'PATCH' }, token);
}

// ---- Seller Portal ----

export interface SellerMe {
  business_id: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  business_type: string | null;
  cod_service: boolean;
  wallet_balance: number;
  wallet_locked: boolean;
  wallet_lock_reason: string | null;
  status: string | null;
  verified: boolean;
}

export interface SellerSettlement {
  id: string;
  order_id: string;
  tracking_number: string | null;
  amount: number;
  settle_due_on: string | null;
  status: string;
  settled_at: string | null;
}

export interface SellerUpload {
  id: string;
  original_filename: string;
  file_type: string | null;
  row_count: number | null;
  status: string;
  created_at: string | null;
}

export function getSellerMe(token: string) {
  return request<SellerMe>('/seller/me', { method: 'GET' }, token);
}

export function getSellerSettlements(token: string) {
  return request<SellerSettlement[]>('/seller/settlements', { method: 'GET' }, token);
}

export function getSellerSettlementSummary(token: string) {
  return request<{ pending_count: number; pending_amount: number }>('/seller/settlements/summary', { method: 'GET' }, token);
}

export function getSellerTransactions(token: string) {
  return request<WalletTransaction[]>('/seller/wallet/transactions', { method: 'GET' }, token);
}

export interface SellerAnalytics {
  total_shipments: number;
  rto_rate: number;
  status_counts: Record<string, number>;
  daily_shipments: { date: string; shipments: number }[];
}

export function getSellerAnalytics(token: string, days = 14) {
  return request<SellerAnalytics>(`/seller/analytics?days=${days}`, { method: 'GET' }, token);
}

export async function uploadSellerFile(file: File, token: string) {
  const form = new FormData();
  form.append('file', file);
  return request<SellerUpload>('/seller/uploads', {
    method: 'POST',
    body: form,
  }, token);
}

export function listSellerUploads(token: string) {
  return request<SellerUpload[]>('/seller/uploads', { method: 'GET' }, token);
}

export function registerRNP(payload: { shop_name: string; owner_name?: string; phone: string; city?: string; address?: string }, token: string) {
  return request<RNP>('/seller/rnp', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function listSellerRNP(token: string) {
  return request<RNP[]>('/seller/rnp', { method: 'GET' }, token);
}

export function getPublicDiscounts() {
  return request<Discount[]>('/discounts/public', { method: 'GET' });
}

// ---- Marketplace ----

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  stock_quantity: number;
  unit_weight_kg: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string | null;
}

export interface ProductPublic extends Product {
  seller_name: string;
  seller_city: string | null;
  seller_rating_avg: number | null;
  seller_rating_count: number;
}

export type ProductCreate = Omit<Product, 'id' | 'business_id' | 'created_at'>;
export type ProductUpdate = Partial<ProductCreate>;

export function listMarketplaceProducts(params?: { q?: string; category?: string; business_id?: string }) {
  const usp = new URLSearchParams();
  if (params?.q) usp.set('q', params.q);
  if (params?.category) usp.set('category', params.category);
  if (params?.business_id) usp.set('business_id', params.business_id);
  const qs = usp.toString();
  return request<ProductPublic[]>(`/marketplace/products${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export function getMarketplaceProduct(productId: string) {
  return request<ProductPublic>(`/marketplace/products/${productId}`, { method: 'GET' });
}

export function listMarketplaceCategories() {
  return request<string[]>('/marketplace/categories', { method: 'GET' });
}

export interface MarketplaceCheckoutPayload {
  product_id: string;
  quantity: number;
  dropoff_address: AddressInput;
  payment_method: 'cash' | 'card' | 'online_gateway' | 'wallet';
  discount_code?: string | null;
  guest_full_name?: string;
  guest_phone?: string;
  guest_email?: string;
}

export interface MarketplaceOrder {
  id: string;
  tracking_number: string;
  status: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  goods_amount: number;
  delivery_fee: number;
  discount_amount: number | null;
  final_price: number | null;
  seller_name: string;
  dropoff_full_address: string;
  created_at: string | null;
}

export function checkoutMarketplaceOrder(payload: MarketplaceCheckoutPayload, token?: string | null) {
  return request<MarketplaceOrder>('/marketplace/checkout', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function getMarketplaceOrderByTracking(trackingNumber: string) {
  return request<MarketplaceOrder>(`/marketplace/orders/${trackingNumber}`, { method: 'GET' });
}

export interface PublicTrackingInfo {
  tracking_number: string;
  status: string;
  history: { status: string; note: string | null; timestamp: string }[];
}

export function trackPublicOrder(trackingNumber: string) {
  return request<PublicTrackingInfo>(`/tracking/${trackingNumber}`, { method: 'GET' });
}

export interface RatingPayload {
  order_id: string;
  score: number;
  comment?: string;
  rater_phone?: string;
}

export interface Rating {
  id: string;
  order_id: string;
  rater_role: 'customer' | 'seller';
  target_type: 'seller' | 'customer';
  score: number;
  comment: string | null;
  created_at: string | null;
}

export interface RatingSummary {
  average: number | null;
  count: number;
  ratings: Rating[];
}

export function submitMarketplaceRating(payload: RatingPayload, token?: string | null) {
  return request<Rating>('/marketplace/ratings', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function getSellerRatingSummary(businessId: string) {
  return request<RatingSummary>(`/marketplace/sellers/${businessId}/ratings`, { method: 'GET' });
}

export function getCustomerRatingSummaryByPhone(phone: string) {
  return request<RatingSummary>(`/marketplace/ratings/by-phone/${encodeURIComponent(phone)}`, { method: 'GET' });
}

// ---- Seller: marketplace products / orders / ratings ----

export function listSellerProducts(token: string) {
  return request<Product[]>('/seller/products', { method: 'GET' }, token);
}

export async function uploadSellerProductImage(file: File, token: string) {
  const form = new FormData();
  form.append('image', file);
  return request<{ url: string }>('/seller/products/upload-image', { method: 'POST', body: form }, token);
}

export function createSellerProduct(payload: ProductCreate, token: string) {
  return request<Product>('/seller/products', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function updateSellerProduct(productId: string, payload: ProductUpdate, token: string) {
  return request<Product>(`/seller/products/${productId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token);
}

export interface SellerMarketplaceOrder {
  id: string;
  tracking_number: string;
  status: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  final_price: number;
  buyer_name: string | null;
  buyer_phone: string | null;
  dropoff_city: string | null;
  created_at: string | null;
}

export function listSellerMarketplaceOrders(token: string) {
  return request<SellerMarketplaceOrder[]>('/seller/marketplace/orders', { method: 'GET' }, token);
}

export interface SellerMarketplaceOrderDetail {
  id: string;
  tracking_number: string;
  status: string;
  created_at: string | null;
  product_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  goods_amount: number;
  delivery_fee: number | null;
  discount_amount: number | null;
  final_price: number | null;
  payment_method: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  seller_name: string;
  seller_phone: string | null;
  seller_address: string | null;
  seller_city: string | null;
  dropoff_full_address: string | null;
  dropoff_city: string | null;
  dropoff_contact_name: string | null;
  dropoff_contact_phone: string | null;
}

export function getSellerMarketplaceOrder(orderId: string, token: string) {
  return request<SellerMarketplaceOrderDetail>(`/seller/marketplace/orders/${orderId}`, { method: 'GET' }, token);
}

export function getSellerRatings(token: string) {
  return request<RatingSummary>('/seller/ratings', { method: 'GET' }, token);
}

// ---- Seller: book / parcels / bulk upload / returns ----

export interface SellerOrderCreatePayload {
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_city: string;
  weight_kg: number;
  cod_amount: number;
}

export function bookSellerOrder(payload: SellerOrderCreatePayload, token: string) {
  return request<Order>('/seller/orders', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export interface SellerParcelRow {
  id: string;
  tracking_number: string;
  status: string;
  source: 'marketplace' | 'store';
  receiver_name: string | null;
  receiver_phone: string | null;
  dropoff_city: string | null;
  cod_amount: number | null;
  created_at: string | null;
}

export function listSellerParcels(token: string, params?: { status?: string; q?: string }) {
  const usp = new URLSearchParams();
  if (params?.status) usp.set('status', params.status);
  if (params?.q) usp.set('q', params.q);
  const qs = usp.toString();
  return request<SellerParcelRow[]>(`/seller/parcels${qs ? `?${qs}` : ''}`, { method: 'GET' }, token);
}

export interface SellerParcelTimelineEvent {
  status: string;
  note: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string | null;
}

export interface SellerParcelDetail {
  id: string;
  tracking_number: string;
  status: string;
  receiver_name: string | null;
  receiver_phone: string | null;
  dropoff_full_address: string | null;
  pickup_full_address: string | null;
  package_weight_kg: number | null;
  cod_amount: number | null;
  final_price: number | null;
  created_at: string | null;
  timeline: SellerParcelTimelineEvent[];
  last_lat: number | null;
  last_lng: number | null;
}

export function getSellerParcelDetail(trackingNumber: string, token: string) {
  return request<SellerParcelDetail>(`/seller/parcels/${trackingNumber}`, { method: 'GET' }, token);
}

export function bulkUploadTemplateUrl() {
  return `${API_ORIGIN}/api/v1/seller/bulk-upload/template`;
}

export interface BulkUploadRow {
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_city: string;
  weight_kg: number;
  cod_amount: number;
}

export interface BulkUploadRowPreview {
  row_number: number;
  data: Record<string, string>;
  errors: string[];
}

export interface BulkUploadPreview {
  upload_id: string;
  valid_count: number;
  error_count: number;
  rows: BulkUploadRowPreview[];
}

export async function previewBulkUpload(file: File, token: string) {
  const form = new FormData();
  form.append('file', file);
  return request<BulkUploadPreview>('/seller/bulk-upload/preview', { method: 'POST', body: form }, token);
}

export interface BulkUploadConfirmResult {
  created_count: number;
  failed_count: number;
  tracking_numbers: string[];
  failures: { row: number; error: string }[];
}

export function confirmBulkUpload(uploadId: string, rows: BulkUploadRow[], token: string) {
  return request<BulkUploadConfirmResult>(
    '/seller/bulk-upload/confirm',
    { method: 'POST', body: JSON.stringify({ upload_id: uploadId, rows }) },
    token
  );
}

export interface SellerReturnRow {
  id: string;
  tracking_number: string;
  receiver_name: string | null;
  dropoff_city: string | null;
  cod_amount: number | null;
  rto_at: string | null;
  sla_hours_left: number;
  sla_breached: boolean;
  batch_id: string | null;
}

export function listSellerReturns(token: string) {
  return request<SellerReturnRow[]>('/seller/returns', { method: 'GET' }, token);
}

// ---- Hub Operations ----

export interface HubOrderSummary {
  id: string;
  tracking_number: string;
  status: string;
  package_description: string | null;
  dropoff_city: string | null;
  updated_at: string;
}

export interface HubAgingOrder extends HubOrderSummary {
  hours_aging: number;
}

export interface HubManifestItem {
  id: string;
  order_id: string | null;
  crate_label: string | null;
  scan_status: string | null;
  tracking_number: string | null;
}

export interface HubManifestSummary {
  id: string;
  manifest_number: string | null;
  coach_number: string | null;
  status: string;
  departure_at: string | null;
  origin_city: string | null;
  destination_city: string | null;
  item_count: number;
  operator_name: string | null;
  direction: 'outbound' | 'inbound';
  items: HubManifestItem[];
}

export interface VendorScore {
  operator_id: string;
  operator_name: string;
  total: number;
  on_time: number;
  on_time_pct: number;
}

export interface HubAnalytics {
  daily: { date: string; parcels_in: number; parcels_out: number }[];
  vendor_scores: VendorScore[];
}

function branchQuery(branchId?: string) {
  return branchId ? `?branch_id=${branchId}` : '';
}

export function getHubInboundQueue(token: string, branchId?: string) {
  return request<HubOrderSummary[]>(`/hub/inbound-queue${branchQuery(branchId)}`, { method: 'GET' }, token);
}

export function scanHubInbound(trackingNumber: string, token: string, branchId?: string) {
  const params = new URLSearchParams({ tracking_number: trackingNumber, ...(branchId ? { branch_id: branchId } : {}) });
  return request<HubOrderSummary>(`/hub/inbound/scan?${params.toString()}`, { method: 'POST' }, token);
}

export function getHubDispatchQueue(token: string, branchId?: string) {
  return request<HubOrderSummary[]>(`/hub/dispatch-queue${branchQuery(branchId)}`, { method: 'GET' }, token);
}

export function getHubManifestHistory(token: string, branchId?: string) {
  return request<HubManifestSummary[]>(`/hub/manifest-history${branchQuery(branchId)}`, { method: 'GET' }, token);
}

export function getHubAgingParcels(token: string, branchId?: string, hours = 4) {
  const params = new URLSearchParams({ hours: String(hours), ...(branchId ? { branch_id: branchId } : {}) });
  return request<HubAgingOrder[]>(`/hub/aging-parcels?${params.toString()}`, { method: 'GET' }, token);
}

export function getHubVendorScores(token: string, branchId?: string) {
  return request<VendorScore[]>(`/hub/vendor-scores${branchQuery(branchId)}`, { method: 'GET' }, token);
}

export function getHubAnalytics(token: string, branchId?: string, days = 14) {
  const params = new URLSearchParams({ days: String(days), ...(branchId ? { branch_id: branchId } : {}) });
  return request<HubAnalytics>(`/hub/analytics?${params.toString()}`, { method: 'GET' }, token);
}

export function getHubRtoQueue(token: string, branchId?: string) {
  return request<HubOrderSummary[]>(`/hub/rto-queue${branchQuery(branchId)}`, { method: 'GET' }, token);
}

// ---- Finance & COD Engine ----

export interface FinanceDashboard {
  cod_collected_total: number;
  cod_pending_payout: number;
  cod_paid_today: number;
  open_disputes: number;
  wallet_locked_riders: number;
  wallet_locked_businesses: number;
  sla_compliance_pct: number;
}

export interface FinanceAnalytics {
  cod_trend: { date: string; collected: number; paid: number }[];
  sla: { on_time: number; late: number; compliance_pct: number };
}

export interface ReconciliationRow {
  business_id?: string;
  company_name?: string;
  zone_id?: string;
  zone_name?: string;
  pending: number;
  paid: number;
  pending_count?: number;
  paid_count?: number;
}

export interface ReconciliationReport {
  by_business: ReconciliationRow[];
  by_corridor: ReconciliationRow[];
}

export interface Dispute {
  id: string;
  order_id: string;
  tracking_number: string | null;
  business_id: string | null;
  company_name: string | null;
  raised_by_id: string;
  reason: string;
  status: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string | null;
}

export interface RiderWallet {
  rider_id: string;
  full_name: string;
  phone: string | null;
  cod_cash_held: number;
  cod_wallet_locked: boolean;
  wallet_limit: number;
  wallet_warning_at: number;
}

export function getFinanceDashboard(token: string) {
  return request<FinanceDashboard>('/finance/dashboard', { method: 'GET' }, token);
}

export function getFinanceAnalytics(token: string, days = 14) {
  return request<FinanceAnalytics>(`/finance/analytics?days=${days}`, { method: 'GET' }, token);
}

export function getFinanceReconciliation(token: string) {
  return request<ReconciliationReport>('/finance/reconciliation', { method: 'GET' }, token);
}

export function listDisputes(token: string, statusFilter?: string) {
  return request<Dispute[]>(
    `/finance/disputes${statusFilter ? `?status_filter=${statusFilter}` : ''}`,
    { method: 'GET' },
    token
  );
}

export function createDispute(orderId: string, reason: string, token: string) {
  return request<Dispute>(
    '/finance/disputes',
    { method: 'POST', body: JSON.stringify({ order_id: orderId, reason }) },
    token
  );
}

export function resolveDispute(disputeId: string, accepted: boolean, note: string | undefined, token: string) {
  return request<Dispute>(
    `/finance/disputes/${disputeId}/resolve`,
    { method: 'PATCH', body: JSON.stringify({ accepted, note }) },
    token
  );
}

export function listRiderWallets(token: string) {
  return request<RiderWallet[]>('/finance/rider-wallets', { method: 'GET' }, token);
}

export function unlockRiderWallet(riderId: string, note: string, token: string) {
  return request<RiderWallet>(
    `/finance/rider-wallets/${riderId}/unlock`,
    { method: 'POST', body: JSON.stringify({ note }) },
    token
  );
}