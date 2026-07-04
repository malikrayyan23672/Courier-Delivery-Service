const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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
  token?: string | null
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

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
  password: string;
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
  package_description?: string;
}

export interface Order {
  id: string;
  tracking_number: string;
  status: string;
  booking_channel: string;
  estimated_price?: number;
  final_price?: number;
}

export function bookOrder(payload: OrderCreatePayload, token: string) {
  return request<Order>('/customer/orders', { method: 'POST', body: JSON.stringify(payload) }, token);
}

export function listMyOrders(token: string) {
  return request<Order[]>('/customer/orders', { method: 'GET' }, token);
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
