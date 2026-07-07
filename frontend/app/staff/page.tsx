'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import { Field } from '@/components/Field';
import { bookStaffOrder, Order, ApiError } from '@/lib/api';

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

      <main className="max-w-3xl mx-auto px-6 md:px-10 py-8">
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
      </main>
    </div>
  );
}
