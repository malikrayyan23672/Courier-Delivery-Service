'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import { getMyOrder, OrderDetail, ApiError } from '@/lib/api';

const STATUS_ORDER = ['created', 'assigned', 'picked_up', 'in_transit', 'delivered'];

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-[#EAF1FC] text-navy',
  assigned: 'bg-[#FBF3EA] text-orange',
  picked_up: 'bg-[#FBF3EA] text-orange',
  in_transit: 'bg-[#FBF3EA] text-orange',
  delivered: 'bg-[#EAF7EF] text-success',
  failed: 'bg-[#FBEAE7] text-danger',
  cancelled: 'bg-[#F0F0F0] text-muted',
};

const NEXT_STEP: Record<string, { title: string; detail: string }> = {
  created: {
    title: 'Waiting for a rider to be assigned',
    detail: "We're matching your shipment with a nearby rider. You'll be notified as soon as one accepts the job.",
  },
  assigned: {
    title: 'Rider is heading to the pickup address',
    detail: 'Your rider has accepted the job and is on the way to collect your package.',
  },
  picked_up: {
    title: 'Package picked up — heading to transit',
    detail: 'Your package has been collected and is being prepared to move toward the drop-off city.',
  },
  in_transit: {
    title: 'Out for delivery',
    detail: 'Your package is on its way to the recipient. It should arrive at the drop-off address soon.',
  },
  delivered: {
    title: 'Delivered',
    detail: 'This shipment has been delivered. No further steps needed.',
  },
  failed: {
    title: 'Delivery attempt failed',
    detail: 'The last delivery attempt was unsuccessful. Our team will reach out to reschedule.',
  },
  cancelled: {
    title: 'Shipment cancelled',
    detail: 'This shipment was cancelled and is no longer being processed.',
  },
};

const TRUCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 3h15v13H1z" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const PIN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const COPY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const BACK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function getProgressPercent(status: string): number {
  if (status === 'failed' || status === 'cancelled') return 0;
  const idx = STATUS_ORDER.indexOf(status);
  if (idx === -1) return 0;
  return Math.round((idx / (STATUS_ORDER.length - 1)) * 100);
}

export default function ShipmentTrackingPage() {
  return (
    <RoleGuard allowedRoles={['customer']}>
      <ShipmentTrackingContent />
    </RoleGuard>
  );
}

function ShipmentTrackingContent() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
    }
  }, [isLoading, token, router]);

  useEffect(() => {
    if (!token || !orderId) return;
    setLoading(true);
    getMyOrder(orderId, token)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this shipment.'))
      .finally(() => setLoading(false));
  }, [token, orderId]);

  function handleCopy() {
    if (!order) return;
    navigator.clipboard?.writeText(order.tracking_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (isLoading || !token) return null;

  const percent = order ? getProgressPercent(order.status) : 0;
  const nextStep = order ? NEXT_STEP[order.status] : null;
  const isIssue = order?.status === 'failed' || order?.status === 'cancelled';
  const isDelivered = order?.status === 'delivered';

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-10 py-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-navy transition-colors mb-6"
        >
          <span className="w-4 h-4">{BACK_ICON}</span>
          Back to My Shipments
        </button>

        {loading && <p className="text-muted text-sm">Loading shipment…</p>}
        {error && <p className="text-danger text-sm">{error}</p>}

        {order && (
          <div className="flex flex-col gap-6">
            {/* Header card */}
            <div className="bg-white rounded-card shadow-card p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Tracking Number</p>
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-xl font-bold text-ink font-mono">{order.tracking_number}</h1>
                    <button
                      onClick={handleCopy}
                      title="Copy tracking number"
                      className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-orange hover:bg-page transition-colors"
                    >
                      <span className="w-4 h-4 block">{COPY_ICON}</span>
                    </button>
                    {copied && <span className="text-xs text-success font-semibold">Copied!</span>}
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-line text-ink'}`}>
                  {formatStatus(order.status)}
                </span>
              </div>
            </div>

            {/* Route + progress */}
            <div className="bg-white rounded-card shadow-card p-6 md:p-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display font-bold text-sm text-ink">Route Progress</h2>
                {!isIssue && (
                  <span className="text-sm font-semibold text-orange">{percent}% of the way there</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex gap-2">
                  <span className="w-4 h-4 text-orange mt-0.5 shrink-0">{PIN_ICON}</span>
                  <div>
                    <p className="text-[0.7rem] font-semibold text-muted uppercase tracking-wide">Pickup</p>
                    <p className="text-sm font-semibold text-ink">{order.pickup_address?.city || order.pickup_address?.full_address || '—'}</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-self-end text-right">
                  <div>
                    <p className="text-[0.7rem] font-semibold text-muted uppercase tracking-wide">Drop-off</p>
                    <p className="text-sm font-semibold text-ink">{order.dropoff_address?.city || order.dropoff_address?.full_address || '—'}</p>
                  </div>
                  <span className="w-4 h-4 text-navy mt-0.5 shrink-0">{PIN_ICON}</span>
                </div>
              </div>

              {/* Progress bar with moving truck */}
              <div className="relative pt-2 pb-1">
                <div className="h-2 rounded-full bg-line overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isIssue ? 'bg-danger' : 'bg-orange'}`}
                    style={{ width: `${isIssue ? 100 : percent}%` }}
                  />
                </div>
                {!isIssue && (
                  <div
                    className="absolute -top-1 w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center shadow-card transition-all duration-500"
                    style={{ left: `calc(${percent}% - 14px)` }}
                  >
                    <span className="w-3.5 h-3.5">{TRUCK_ICON}</span>
                  </div>
                )}
              </div>

              {/* Stage labels */}
              {!isIssue && (
                <div className="flex justify-between mt-3 text-[0.68rem] text-muted font-semibold">
                  {STATUS_ORDER.map((s) => (
                    <span key={s} className={STATUS_ORDER.indexOf(order.status) >= STATUS_ORDER.indexOf(s) ? 'text-navy' : ''}>
                      {formatStatus(s)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Next step callout */}
            {nextStep && (
              <div
                className={`rounded-card p-6 md:p-8 ${
                  isDelivered ? 'bg-[#EAF7EF]' : isIssue ? 'bg-[#FBEAE7]' : 'bg-[#FBF3EA]'
                }`}
              >
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide mb-1.5 text-muted">
                  {isDelivered ? 'Complete' : 'Next Step'}
                </p>
                <h3 className={`font-display font-bold text-lg mb-1.5 ${isDelivered ? 'text-success' : isIssue ? 'text-danger' : 'text-orange'}`}>
                  {nextStep.title}
                </h3>
                <p className="text-sm text-ink">{nextStep.detail}</p>
              </div>
            )}

            {/* Full place-to-place log */}
            <div className="bg-white rounded-card shadow-card p-6 md:p-8">
              <h2 className="font-display font-bold text-sm text-ink mb-4">Shipment Log</h2>
              {order.tracking_events.length === 0 ? (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange shrink-0" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">Order placed</p>
                    <p className="text-xs text-muted mt-0.5">{formatDate(order.created_at)}</p>
                    <p className="text-sm text-muted mt-2">No further log entries yet — this will update as your shipment moves.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Order-placed is always first chronologically */}
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-navy shrink-0" />
                      <div className="w-[2px] flex-1 bg-line mt-1" />
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-semibold text-ink">Order placed</p>
                      <p className="text-xs text-muted mt-0.5">{formatDate(order.created_at)}</p>
                    </div>
                  </div>

                  {order.tracking_events.map((event, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center pt-1">
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            i === order.tracking_events.length - 1 ? 'bg-orange' : 'bg-navy'
                          }`}
                        />
                        {i < order.tracking_events.length - 1 && <div className="w-[2px] flex-1 bg-line mt-1" />}
                      </div>
                      <div className="pb-1">
                        <p className="text-sm font-semibold text-ink capitalize">{formatStatus(event.status)}</p>
                        {event.note && <p className="text-sm text-muted">{event.note}</p>}
                        {(event.lat != null && event.lng != null) && (
                          <p className="text-xs text-muted">
                            {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
                          </p>
                        )}
                        <p className="text-xs text-muted mt-0.5">{formatDate(event.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
