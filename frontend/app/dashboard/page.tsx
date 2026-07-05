'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import { Field } from '@/components/Field';
import { bookOrder, listMyOrders, Order, ApiError } from '@/lib/api';

const BOX_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
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

export default function DashboardPage() {
  return (
    <RoleGuard allowedRoles={['customer']}>
      <DashboardContent />
    </RoleGuard>
  );
}

function DashboardContent() {
  const { token, isLoading, setToken } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    pickup_address: '',
    pickup_city: '',
    dropoff_address: '',
    dropoff_city: '',
    weight: '',
    description: '',
  });

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
    }
  }, [isLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    listMyOrders(token)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, [token]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setFormError('');
    try {
      const order = await bookOrder(
        {
          pickup_address: { full_address: form.pickup_address, city: form.pickup_city },
          dropoff_address: { full_address: form.dropoff_address, city: form.dropoff_city },
          package_weight_kg: form.weight ? parseFloat(form.weight) : undefined,
          package_description: form.description || undefined,
        },
        token
      );
      setOrders((prev) => [order, ...prev]);
      setShowBookingForm(false);
      setForm({ pickup_address: '', pickup_city: '', dropoff_address: '', dropoff_city: '', weight: '', description: '' });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not book order.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  if (isLoading || !token) return null;

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <button
          onClick={handleLogout}
          className="text-sm font-semibold text-muted hover:text-navy transition-colors"
        >
          Log out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Your Shipments</h1>
            <p className="text-muted text-sm mt-1">Book a new pickup or check on an existing order</p>
          </div>
          <button
            onClick={() => setShowBookingForm((s) => !s)}
            className="bg-orange hover:bg-orange-light text-white font-bold text-sm px-5 py-3 rounded-[10px] transition-colors"
          >
            {showBookingForm ? 'Cancel' : '+ Book a Shipment'}
          </button>
        </div>

        {showBookingForm && (
          <form
            onSubmit={handleBook}
            className="bg-white rounded-card shadow-card p-6 md:p-8 mb-8"
          >
            <h2 className="font-display font-bold text-lg mb-5">Pickup &amp; Drop-off Details</h2>
            <div className="grid md:grid-cols-2 gap-x-6">
              <Field
                id="pickup_address"
                label="Pickup Address"
                icon={BOX_ICON}
                placeholder="House/street, area"
                required
                value={form.pickup_address}
                onChange={(e) => setForm((f) => ({ ...f, pickup_address: e.target.value }))}
              />
              <Field
                id="pickup_city"
                label="Pickup City"
                icon={BOX_ICON}
                placeholder="e.g. Islamabad"
                value={form.pickup_city}
                onChange={(e) => setForm((f) => ({ ...f, pickup_city: e.target.value }))}
              />
              <Field
                id="dropoff_address"
                label="Drop-off Address"
                icon={BOX_ICON}
                placeholder="House/street, area"
                required
                value={form.dropoff_address}
                onChange={(e) => setForm((f) => ({ ...f, dropoff_address: e.target.value }))}
              />
              <Field
                id="dropoff_city"
                label="Drop-off City"
                icon={BOX_ICON}
                placeholder="e.g. Lahore"
                value={form.dropoff_city}
                onChange={(e) => setForm((f) => ({ ...f, dropoff_city: e.target.value }))}
              />
              <Field
                id="weight"
                type="number"
                step="0.1"
                label="Package Weight (kg)"
                icon={BOX_ICON}
                placeholder="e.g. 2.5"
                value={form.weight}
                onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              />
              <Field
                id="description"
                label="Package Description"
                icon={BOX_ICON}
                placeholder="e.g. Documents"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {formError && <p className="text-sm text-danger mb-4">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="bg-navy hover:bg-navy-light text-white font-bold text-sm px-6 py-3 rounded-[10px] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Booking…' : 'Confirm Booking'}
            </button>
          </form>
        )}

        <div className="bg-white rounded-card shadow-card overflow-hidden">
          {loadingOrders ? (
            <p className="p-6 text-muted text-sm">Loading your orders…</p>
          ) : orders.length === 0 ? (
            <p className="p-6 text-muted text-sm">
              No shipments yet. Book your first one above.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-6 py-3 font-semibold">Tracking #</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Channel</th>
                  <th className="px-6 py-3 font-semibold">Est. Price</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-line last:border-0">
                    <td className="px-6 py-3.5 font-mono text-ink">{order.tracking_number}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-line text-ink'}`}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-muted capitalize">{order.booking_channel}</td>
                    <td className="px-6 py-3.5 text-ink">
                      {order.estimated_price ? `Rs. ${order.estimated_price}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
