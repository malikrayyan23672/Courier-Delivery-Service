const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const ACCESS_TOKEN_KEY = 'fastex_access_token';
const REFRESH_TOKEN_KEY = 'fastex_refresh_token';

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
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
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

export function updateDeliveryStatus(orderId: string, newStatus: string, note: string | undefined, token: string) {
  const params = new URLSearchParams({ new_status: newStatus, ...(note ? { note } : {}) });
  return request<{ message: string; status: string }>(
    `/rider/deliveries/${orderId}/status?${params.toString()}`,
    { method: 'PATCH' },
    token
  );
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