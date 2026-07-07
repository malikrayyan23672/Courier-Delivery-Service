'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMyOrder, OrderDetail, ApiError } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-[#EAF1FC] text-navy',
  assigned: 'bg-[#FBF3EA] text-orange',
  picked_up: 'bg-[#FBF3EA] text-orange',
  in_transit: 'bg-[#FBF3EA] text-orange',
  delivered: 'bg-[#EAF7EF] text-success',
  failed: 'bg-[#FBEAE7] text-danger',
  cancelled: 'bg-[#F0F0F0] text-muted',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: 'bg-[#EAF7EF] text-success',
  pending: 'bg-[#FBF3EA] text-orange',
  failed: 'bg-[#FBEAE7] text-danger',
  refunded: 'bg-[#F0F0F0] text-muted',
};

const STATUS_ORDER = ['created', 'assigned', 'picked_up', 'in_transit', 'delivered'];

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

const CLOSE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const COPY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const PIN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export function OrderDetailModal({
  orderId,
  token,
  onClose,
}: {
  orderId: string;
  token: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyOrder(orderId, token)
      .then((o) => { if (!cancelled) setOrder(o); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load order.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId, token]);

  function handleCopy() {
    if (!order) return;
    navigator.clipboard?.writeText(order.tracking_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const currentStepIndex = order ? STATUS_ORDER.indexOf(order.status) : -1;
  const isTerminalIssue = order?.status === 'failed' || order?.status === 'cancelled';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F2648]/40 flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-card shadow-card w-full max-w-2xl my-6 md:my-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 md:px-8 py-5 border-b border-line">
          <div>
            <p className="text-xs font-semibold text-muted tracking-wide uppercase mb-1">Shipment details</p>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-ink font-mono">
                {order ? order.tracking_number : 'Loading…'}
              </h2>
              {order && (
                <button
                  onClick={handleCopy}
                  title="Copy tracking number"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-orange hover:bg-page transition-colors"
                >
                  <span className="w-4 h-4 block">{COPY_ICON}</span>
                </button>
              )}
              {copied && <span className="text-xs text-success font-semibold">Copied!</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-page transition-colors shrink-0"
          >
            <span className="w-4.5 h-4.5 block">{CLOSE_ICON}</span>
          </button>
        </div>

        <div className="px-6 md:px-8 py-6 max-h-[70vh] overflow-y-auto">
          {loading && <p className="text-muted text-sm">Loading shipment details…</p>}
          {error && <p className="text-danger text-sm">{error}</p>}

          {order && (
            <div className="flex flex-col gap-6">
              {/* Status + progress */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-line text-ink'}`}>
                    {formatStatus(order.status)}
                  </span>
                  <span className="text-xs text-muted">Booked {formatDate(order.created_at)}</span>
                </div>

                {!isTerminalIssue && (
                  <div className="flex items-center">
                    {STATUS_ORDER.map((step, i) => (
                      <div key={step} className="flex items-center flex-1 last:flex-none">
                        <div
                          className={`w-3 h-3 rounded-full shrink-0 ${
                            i <= currentStepIndex ? 'bg-orange' : 'bg-line'
                          }`}
                        />
                        {i < STATUS_ORDER.length - 1 && (
                          <div className={`h-[2px] flex-1 ${i < currentStepIndex ? 'bg-orange' : 'bg-line'}`} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Addresses */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-page rounded-[14px] p-4">
                  <p className="text-[0.7rem] font-semibold text-muted uppercase tracking-wide mb-2">Pickup</p>
                  <div className="flex gap-2">
                    <span className="w-4 h-4 text-orange mt-0.5 shrink-0">{PIN_ICON}</span>
                    <div className="text-sm text-ink">
                      <p className="font-semibold">{order.pickup_address?.full_address || '—'}</p>
                      <p className="text-muted">{order.pickup_address?.city}</p>
                      {order.pickup_address?.contact_name && (
                        <p className="text-muted mt-1">
                          {order.pickup_address.contact_name}
                          {order.pickup_address.contact_phone ? ` · ${order.pickup_address.contact_phone}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-page rounded-[14px] p-4">
                  <p className="text-[0.7rem] font-semibold text-muted uppercase tracking-wide mb-2">Drop-off</p>
                  <div className="flex gap-2">
                    <span className="w-4 h-4 text-navy mt-0.5 shrink-0">{PIN_ICON}</span>
                    <div className="text-sm text-ink">
                      <p className="font-semibold">{order.dropoff_address?.full_address || '—'}</p>
                      <p className="text-muted">{order.dropoff_address?.city}</p>
                      {order.dropoff_address?.contact_name && (
                        <p className="text-muted mt-1">
                          {order.dropoff_address.contact_name}
                          {order.dropoff_address.contact_phone ? ` · ${order.dropoff_address.contact_phone}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Package + payment + rider */}
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[0.7rem] font-semibold text-muted uppercase tracking-wide mb-1.5">Package</p>
                  <p className="text-ink">{order.package_description || 'No description'}</p>
                  {order.package_weight_kg != null && (
                    <p className="text-muted">{order.package_weight_kg} kg</p>
                  )}
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold text-muted uppercase tracking-wide mb-1.5">Payment</p>
                  <p className="text-ink font-semibold">
                    {order.final_price ?? order.estimated_price ? `Rs. ${order.final_price ?? order.estimated_price}` : '—'}
                  </p>
                  {order.payment && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-muted capitalize">{order.payment.method.replace('_', ' ')}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[0.68rem] font-semibold ${PAYMENT_STATUS_COLORS[order.payment.status] || 'bg-line text-ink'}`}>
                        {order.payment.status}
                      </span>
                    </div>
                  )}
                </div>
                {order.rider && (
                  <div className="sm:col-span-2 border-t border-line pt-4">
                    <p className="text-[0.7rem] font-semibold text-muted uppercase tracking-wide mb-1.5">Rider</p>
                    <p className="text-ink">
                      {order.rider.full_name}
                      {order.rider.vehicle_type ? ` · ${order.rider.vehicle_type}` : ''}
                      {' · ★ ' + order.rider.rating.toFixed(1)}
                    </p>
                    <p className="text-muted">{order.rider.phone}</p>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="border-t border-line pt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[0.7rem] font-semibold text-muted uppercase tracking-wide">Tracking history</p>
                  <button
                    onClick={() => router.push(`/dashboard/shipment/${order.id}`)}
                    className="text-xs font-semibold text-orange hover:text-orange-light transition-colors"
                  >
                    View full route &amp; log →
                  </button>
                </div>
                {order.tracking_events.length === 0 ? (
                  <p className="text-sm text-muted">No tracking updates yet.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {order.tracking_events
                      .slice()
                      .reverse()
                      .map((event, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center pt-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-orange shrink-0" />
                            {i < order.tracking_events.length - 1 && <div className="w-[2px] flex-1 bg-line mt-1" />}
                          </div>
                          <div className="pb-1">
                            <p className="text-sm font-semibold text-ink capitalize">{formatStatus(event.status)}</p>
                            {event.note && <p className="text-sm text-muted">{event.note}</p>}
                            <p className="text-xs text-muted mt-0.5">{formatDate(event.created_at)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
