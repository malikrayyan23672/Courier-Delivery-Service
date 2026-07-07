'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import { Field } from '@/components/Field';
import {
  bookStaffOrder,
  listStaffOrders,
  listStaffRiders,
  staffAssignRider,
  Order,
  StaffRider,
  ApiError,
} from '@/lib/api';

const BOX_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
  </svg>
);
const USER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const PHONE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-[#EAF1FC] text-navy',
  assigned: 'bg-[#FBF3EA] text-orange',
  picked_up: 'bg-[#FBF3EA] text-orange',
  in_transit: 'bg-[#FBF3EA] text-orange',
  delivered: 'bg-[#EAF7EF] text-success',
  failed: 'bg-[#FBEAE7] text-danger',
  cancelled: 'bg-[#F0F0F0] text-muted',
};

export default function StaffPage() {
  return (
    <RoleGuard allowedRoles={['staff', 'admin', 'super_admin']}>
      <StaffContent />
    </RoleGuard>
  );
}

function StaffContent() {
  const { token, setToken } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<'book' | 'orders'>('book');

  // Booking Form State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Order | null>(null);
  const [form, setForm] = useState({
    guest_full_name: '',
    guest_phone: '',
    pickup_address: '',
    pickup_city: '',
    dropoff_address: '',
    dropoff_city: '',
    weight: '',
    description: '',
    payment_method: 'cash',
    package_size: 'small',
  });

  // Branch Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<StaffRider[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState('');

  // Fetch branch orders and zone riders when switching to orders tab
  useEffect(() => {
    if (tab === 'orders' && token) {
      loadBranchData();
    }
  }, [tab, token]);

  function loadBranchData() {
    setLoadingOrders(true);
    setOrdersError('');
    Promise.all([listStaffOrders(token!), listStaffRiders(token!)])
      .then(([o, r]) => {
        setOrders(o);
        setRiders(r);
      })
      .catch((err) => {
        setOrdersError(err instanceof ApiError ? err.message : 'Could not load branch data.');
      })
      .finally(() => {
        setLoadingOrders(false);
      });
  }

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');
    setBooked(null);
    try {
      const order = await bookStaffOrder(
        {
          guest_full_name: form.guest_full_name,
          guest_phone: form.guest_phone,
          pickup_address: { full_address: form.pickup_address, city: form.pickup_city },
          dropoff_address: { full_address: form.dropoff_address, city: form.dropoff_city },
          package_weight_kg: form.weight ? parseFloat(form.weight) : undefined,
          package_description: form.description || undefined,
          package_size: form.package_size as 'small' | 'medium' | 'large' | 'documents',
          payment_method: form.payment_method as 'cash' | 'card' | 'online_gateway',
        },
        token
      );

      setBooked(order);
      setForm({
        guest_full_name: '',
        guest_phone: '',
        pickup_address: '',
        pickup_city: '',
        dropoff_address: '',
        dropoff_city: '',
        weight: '',
        description: '',
        payment_method: 'cash',
        package_size: 'small',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not book order.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(orderId: string, riderId: string) {
    if (!riderId || !token) return;
    setAssigningId(orderId);
    setOrdersError('');
    try {
      await staffAssignRider(orderId, riderId, token);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'assigned', rider_accepted: null } : o))
      );
    } catch (err) {
      setOrdersError(err instanceof ApiError ? err.message : 'Could not assign rider.');
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-orange bg-[#FBF3EA] px-3 py-1 rounded-full">
            Staff Panel
          </span>
          <button onClick={handleLogout} className="text-sm font-semibold text-muted hover:text-navy transition-colors">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 md:px-10 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 border-b border-line">
          <button
            onClick={() => setTab('book')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'book' ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Book Walk-in Shipment
          </button>
          <button
            onClick={() => setTab('orders')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'orders' ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Branch Orders
          </button>
        </div>

        {tab === 'book' ? (
          <div>
            <h1 className="font-display text-2xl font-bold text-ink mb-1">Book a Walk-in Shipment</h1>
            <p className="text-muted text-sm mb-6">
              For customers booking in person at the counter. Payment is collected on the spot.
            </p>

            {booked && (
              <div className="bg-[#EAF7EF] border border-success/30 rounded-[10px] px-5 py-4 mb-6">
                <p className="font-bold text-success">Order booked successfully</p>
                <p className="text-sm text-ink mt-1">
                  Tracking number: <span className="font-mono font-bold">{booked.tracking_number}</span>
                  {booked.estimated_price ? ` — Rs. ${booked.estimated_price}` : ''}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white rounded-card shadow-card p-6 md:p-8">
              <h2 className="font-display font-bold text-lg mb-4">Customer Details</h2>
              <div className="grid md:grid-cols-2 gap-x-6">
                <Field
                  id="guest_full_name"
                  label="Full Name"
                  icon={USER_ICON}
                  placeholder="Customer's name"
                  required
                  value={form.guest_full_name}
                  onChange={(e) => update('guest_full_name', e.target.value)}
                />
                <Field
                  id="guest_phone"
                  label="Phone Number"
                  icon={PHONE_ICON}
                  placeholder="e.g. 03001234567"
                  required
                  value={form.guest_phone}
                  onChange={(e) => update('guest_phone', e.target.value)}
                />
              </div>

              <h2 className="font-display font-bold text-lg mb-4 mt-2">Pickup &amp; Drop-off</h2>
              <div className="grid md:grid-cols-2 gap-x-6">
                <Field
                  id="pickup_address"
                  label="Pickup Address"
                  icon={BOX_ICON}
                  placeholder="House/street, area"
                  required
                  value={form.pickup_address}
                  onChange={(e) => update('pickup_address', e.target.value)}
                />
                <Field
                  id="pickup_city"
                  label="Pickup City"
                  icon={BOX_ICON}
                  placeholder="e.g. Rawalpindi"
                  value={form.pickup_city}
                  onChange={(e) => update('pickup_city', e.target.value)}
                />
                <Field
                  id="dropoff_address"
                  label="Drop-off Address"
                  icon={BOX_ICON}
                  placeholder="House/street, area"
                  required
                  value={form.dropoff_address}
                  onChange={(e) => update('dropoff_address', e.target.value)}
                />
                <Field
                  id="dropoff_city"
                  label="Drop-off City"
                  icon={BOX_ICON}
                  placeholder="e.g. Lahore"
                  value={form.dropoff_city}
                  onChange={(e) => update('dropoff_city', e.target.value)}
                />
                <Field
                  id="weight"
                  type="number"
                  step="0.1"
                  label="Package Weight (kg)"
                  icon={BOX_ICON}
                  placeholder="e.g. 1.5"
                  value={form.weight}
                  onChange={(e) => update('weight', e.target.value)}
                />
                <Field
                  id="description"
                  label="Package Description"
                  icon={BOX_ICON}
                  placeholder="e.g. Small parcel"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                />
              </div>

              <div className="mb-5">
                <label className="text-[0.82rem] font-semibold text-ink block mb-1.5">Payment Method</label>
                <select
                  value={form.payment_method}
                  onChange={(e) => update('payment_method', e.target.value)}
                  className="w-full text-[0.92rem] py-3 px-3.5 rounded-[10px] border-[1.5px] border-line bg-[#FBFCFE] text-ink outline-none focus:border-orange"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="online_gateway">Online payment link</option>
                </select>
              </div>

              <div className="mb-5">
                <label className="text-[0.82rem] font-semibold text-ink block mb-1.5">Package Size</label>
                <select
                  value={form.package_size}
                  onChange={(e) => setForm((f) => ({ ...f, package_size: e.target.value }))}
                  className="w-full text-[0.92rem] py-3 px-3.5 rounded-[10px] border-[1.5px] border-line bg-[#FBFCFE] text-ink outline-none focus:border-orange"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="documents">Documents</option>
                </select>
              </div>

              {error && <p className="text-sm text-danger mb-4">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="bg-navy hover:bg-navy-light text-white font-bold text-sm px-6 py-3 rounded-[10px] disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Booking…' : 'Confirm Booking'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h1 className="font-display text-2xl font-bold text-ink mb-1">Branch Shipments</h1>
            <p className="text-muted text-sm mb-6">
              Manage deliveries associated with your branch and assign riders manually.
            </p>

            {ordersError && (
              <div className="bg-[#FBEAE7] text-danger text-sm rounded-[10px] px-4 py-3 mb-6">
                {ordersError}
              </div>
            )}

            <div className="bg-white rounded-card shadow-card overflow-hidden">
              {loadingOrders ? (
                <p className="p-6 text-muted text-sm text-center">Loading orders…</p>
              ) : orders.length === 0 ? (
                <p className="p-6 text-muted text-sm text-center">No shipments booked for this branch yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-line text-muted bg-[#FBFCFE]">
                        <th className="px-6 py-3 font-semibold">Tracking #</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                        <th className="px-6 py-3 font-semibold">Destination</th>
                        <th className="px-6 py-3 font-semibold">Assign Rider</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b border-line last:border-0 hover:bg-page/50">
                          <td className="px-6 py-4 font-mono font-bold text-ink">{order.tracking_number}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap capitalize ${
                                STATUS_COLORS[order.status] || 'bg-line text-ink'
                              }`}
                            >
                              {order.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-ink max-w-xs truncate">{order.dropoff_address?.full_address}</p>
                            <span className="text-xs text-muted block mt-0.5">{order.dropoff_address?.city || 'Lahore'}</span>
                          </td>
                          <td className="px-6 py-4">
                            {order.status === 'created' ? (
                              <select
                                disabled={assigningId === order.id}
                                onChange={(e) => handleAssign(order.id, e.target.value)}
                                defaultValue=""
                                className="text-sm py-1.5 px-2.5 rounded-[8px] border border-line bg-page text-ink max-w-[180px] outline-none focus:border-orange cursor-pointer"
                              >
                                <option value="" disabled>
                                  {assigningId === order.id ? 'Assigning…' : 'Select Rider'}
                                </option>
                                {riders.map((r) => (
                                  <option key={r.rider_id} value={r.rider_id}>
                                    {r.full_name} ({r.vehicle_type || 'bike'})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
