'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import { listMyDeliveries, updateDeliveryStatus, Order, ApiError } from '@/lib/api';

const STATUS_FLOW: Record<string, string | null> = {
  assigned: 'picked_up',
  picked_up: 'in_transit',
  in_transit: 'delivered',
  delivered: null,
  failed: null,
  cancelled: null,
  created: null,
};

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Mark Picked Up',
  picked_up: 'Mark In Transit',
  in_transit: 'Mark Delivered',
};

const STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-[#EAF1FC] text-navy',
  picked_up: 'bg-[#FBF3EA] text-orange',
  in_transit: 'bg-[#FBF3EA] text-orange',
  delivered: 'bg-[#EAF7EF] text-success',
  failed: 'bg-[#FBEAE7] text-danger',
};

export default function RiderPage() {
  return (
    <RoleGuard allowedRoles={['rider']}>
      <RiderContent />
    </RoleGuard>
  );
}

function RiderContent() {
  const { token, setToken } = useAuth();
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    loadDeliveries();
  }, [token]);

  function loadDeliveries() {
    if (!token) return;
    setLoading(true);
    listMyDeliveries(token)
      .then(setDeliveries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load deliveries.'))
      .finally(() => setLoading(false));
  }

  async function handleAdvanceStatus(order: Order) {
    const nextStatus = STATUS_FLOW[order.status];
    if (!token || !nextStatus) return;
    setUpdatingId(order.id);
    setError('');
    try {
      await updateDeliveryStatus(order.id, nextStatus, undefined, token);
      setDeliveries((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update status.');
    } finally {
      setUpdatingId(null);
    }
  }

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-orange bg-[#FBF3EA] px-3 py-1 rounded-full">
            Rider Panel
          </span>
          <button onClick={handleLogout} className="text-sm font-semibold text-muted hover:text-navy transition-colors">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-10 py-8">
        <h1 className="font-display text-2xl font-bold text-ink mb-1">Your Deliveries</h1>
        <p className="text-muted text-sm mb-6">Update the status as you pick up and deliver packages.</p>

        {error && <p className="text-sm text-danger mb-4">{error}</p>}

        {loading ? (
          <p className="text-muted text-sm">Loading deliveries…</p>
        ) : deliveries.length === 0 ? (
          <div className="bg-white rounded-card shadow-card p-6 text-muted text-sm">
            No deliveries assigned to you right now.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {deliveries.map((order) => {
              const nextStatus = STATUS_FLOW[order.status];
              return (
                <div key={order.id} className="bg-white rounded-card shadow-card p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono font-bold text-ink">{order.tracking_number}</p>
                    <span
                      className={`inline-block mt-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-line text-ink'}`}
                    >
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                  {nextStatus && (
                    <button
                      onClick={() => handleAdvanceStatus(order)}
                      disabled={updatingId === order.id}
                      className="bg-navy hover:bg-navy-light text-white font-bold text-sm px-4 py-2.5 rounded-[10px] disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {updatingId === order.id ? 'Updating…' : STATUS_LABELS[order.status]}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
