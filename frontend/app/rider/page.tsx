'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import {
  listMyDeliveries,
  updateDeliveryStatus,
  respondToDelivery,
  getRiderProfile,
  updateRiderAvailability,
  updateRiderLocation,
  sendDeliveryOtp,
  submitProofOfDelivery,
  Order,
  RiderMe,
  ApiError,
} from '@/lib/api';

/* ---------------------------------- icons ---------------------------------- */

const PIN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
    <path d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

const FLAG_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
    <path d="M4 22V4" />
    <path d="M4 4h14l-3 4 3 4H4" />
  </svg>
);

const BOX_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
  </svg>
);

const LOCATE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M22 12h-3M5 12H2" />
  </svg>
);

const STAR_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
    <path d="M12 2.5l2.9 6.06 6.6.87-4.83 4.6 1.24 6.57L12 17.3l-5.91 3.3 1.24-6.57L2.5 9.43l6.6-.87L12 2.5Z" />
  </svg>
);

/* -------------------------------- status maps ------------------------------- */

// Only the two edges a rider can advance directly via the generic status
// endpoint - everything else is driven by hub/manifest scans, or by the
// dedicated OTP+photo+GPS delivery modal (out_for_delivery -> delivered).
const STATUS_FLOW: Record<string, string | null> = {
  assigned: 'picked_up',
  picked_up: 'out_for_delivery',
  in_hub: null,
  in_transit: null,
  dest_hub: null,
  out_for_delivery: null,
  delivered: null,
  failed: null,
  rto: null,
  cancelled: null,
  created: null,
};

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Mark picked up',
  picked_up: 'Start delivery',
};

const STATUS_BADGE: Record<string, string> = {
  created: 'bg-[#EAF1FC] text-navy',
  assigned: 'bg-[#EAF1FC] text-navy',
  picked_up: 'bg-[#FBF3EA] text-orange',
  in_hub: 'bg-[#FBF3EA] text-orange',
  in_transit: 'bg-[#FBF3EA] text-orange',
  dest_hub: 'bg-[#FBF3EA] text-orange',
  out_for_delivery: 'bg-[#FBF3EA] text-orange',
  delivered: 'bg-[#EAF7EF] text-success',
  failed: 'bg-[#FBEAE7] text-danger',
  rto: 'bg-[#FBEAE7] text-danger',
  cancelled: 'bg-[#F0F0F0] text-muted-foreground',
};

const ACTIVE_STATUSES = new Set(['assigned', 'picked_up', 'in_hub', 'in_transit', 'dest_hub', 'out_for_delivery']);
// Statuses currently sitting with the hub/bus network - nothing for the rider to do but wait.
const HUB_HELD_STATUSES = new Set(['in_hub', 'in_transit']);

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function getGeolocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error("This device/browser doesn't support location sharing."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Location permission denied - GPS is required for this step.')),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

/* ---------------------------------- page ------------------------------------ */

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

  const [profile, setProfile] = useState<RiderMe | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [deliveringOrder, setDeliveringOrder] = useState<Order | null>(null);

  // Location is manual and one-shot: the rider taps "I've arrived at branch",
  // we grab their position once, send it once, and nothing runs in the
  // background after that - no watch, no interval, no polling, no re-render
  // loop. Deliberately isolated from `deliveries`/`profile` state so this
  // never affects anything else on the page.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<Date | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadProfile();
    loadDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleArrivedAtBranch() {
    if (!token) return;
    setLocating(true);
    setLocationError('');
    getGeolocation()
      .then((next) =>
        updateRiderLocation(next.lat, next.lng, token).then(() => {
          setCoords(next);
          setLocationUpdatedAt(new Date());
        })
      )
      .catch((err) => setLocationError(err instanceof Error ? err.message : 'Could not share location.'))
      .finally(() => setLocating(false));
  }

  function loadProfile() {
    if (!token) return;
    setProfileLoading(true);
    getRiderProfile(token)
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your profile.'))
      .finally(() => setProfileLoading(false));
  }

  function loadDeliveries() {
    if (!token) return;
    setLoadingDeliveries(true);
    listMyDeliveries(token)
      .then(setDeliveries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load deliveries.'))
      .finally(() => setLoadingDeliveries(false));
  }

  async function handleToggleAvailability() {
    if (!token || !profile) return;
    const next = !profile.is_available;
    setTogglingAvailability(true);
    setProfile({ ...profile, is_available: next }); // optimistic
    try {
      await updateRiderAvailability(next, token);
    } catch (err) {
      setProfile({ ...profile, is_available: !next }); // revert on failure
      setError(err instanceof ApiError ? err.message : 'Could not update your availability.');
    } finally {
      setTogglingAvailability(false);
    }
  }

  async function handleRespond(order: Order, accept: boolean) {
    if (!token) return;
    setRespondingId(order.id);
    setError('');
    try {
      await respondToDelivery(order.id, accept, token);
      if (accept) {
        setDeliveries((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? { ...o, rider_accepted: true, status: o.status === 'dest_hub' ? 'out_for_delivery' : o.status }
              : o
          )
        );
      } else {
        setDeliveries((prev) => prev.filter((o) => o.id !== order.id));
      }
      loadProfile(); // active count changes either way
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not respond to this offer.');
    } finally {
      setRespondingId(null);
    }
  }

  async function handleAdvanceStatus(order: Order) {
    const nextStatus = STATUS_FLOW[order.status];
    if (!token || !nextStatus) return;
    setUpdatingId(order.id);
    setError('');
    try {
      // Both rider-advanceable edges (picked_up, out_for_delivery) require GPS server-side.
      const location = await getGeolocation();
      await updateDeliveryStatus(order.id, nextStatus, undefined, token, location);
      setDeliveries((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));
      loadProfile(); // stats (earnings/active count) may have changed
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not update status.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleReportFailedAttempt(order: Order) {
    if (!token) return;
    setUpdatingId(order.id);
    setError('');
    try {
      let location: { lat: number; lng: number } | undefined;
      try {
        location = await getGeolocation();
      } catch {
        location = undefined; // GPS optional on a failed-attempt report
      }
      const result = await updateDeliveryStatus(order.id, 'failed', 'Buyer unavailable / refused', token, location);
      setDeliveries((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: result.status } : o)));
      loadProfile();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not report this attempt.');
    } finally {
      setUpdatingId(null);
    }
  }

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  const pendingOffers = useMemo(
    () => deliveries.filter((o) => (o.status === 'assigned' || o.status === 'dest_hub') && o.rider_accepted !== true),
    [deliveries]
  );
  const activeDeliveries = useMemo(
    () =>
      deliveries.filter(
        (o) => ACTIVE_STATUSES.has(o.status) && !((o.status === 'assigned' || o.status === 'dest_hub') && o.rider_accepted !== true)
      ),
    [deliveries]
  );
  const completedDeliveries = useMemo(
    () => deliveries.filter((o) => o.status === 'delivered').slice(0, 5),
    [deliveries]
  );

  const wallet = profile
    ? {
        pct: profile.cod_wallet_limit ? Math.min(100, (profile.cod_cash_held / profile.cod_wallet_limit) * 100) : 0,
        atWarning: profile.cod_cash_held >= profile.cod_wallet_warning_at,
      }
    : null;

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-orange bg-[#FBF3EA] px-3 py-1 rounded-full">
            Rider Panel
          </span>
          <button onClick={handleLogout} className="text-sm font-semibold text-muted-foreground hover:text-navy transition-colors">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 md:px-10 py-8">
        {error && (
          <div className="bg-[#FBEAE7] text-danger text-sm rounded-[10px] px-4 py-3 mb-6">{error}</div>
        )}

        {/* profile + availability */}
        <div className="bg-white rounded-card shadow-card p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-navy text-white font-display font-bold flex items-center justify-center text-sm shrink-0">
              {profileLoading ? '···' : initials(profile?.full_name || 'Rider')}
            </div>
            <div>
              <p className="font-display font-bold text-ink leading-tight">
                {profileLoading ? 'Loading…' : profile?.full_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span className="capitalize">{profile?.vehicle_type || 'Vehicle not set'}</span>
                <span className="text-line">•</span>
                <span className="flex items-center gap-1 text-orange">
                  {STAR_ICON}
                  <span className="text-ink font-semibold">{profile?.rating?.toFixed(2) ?? '—'}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleToggleAvailability}
            disabled={profileLoading || togglingAvailability}
            className="flex items-center gap-3 disabled:opacity-60"
          >
            <span className={`text-sm font-semibold ${profile?.is_available ? 'text-success' : 'text-muted-foreground'}`}>
              {profile?.is_available ? 'Online' : 'Offline'}
            </span>
            <span
              className={`relative w-12 h-7 rounded-full transition-colors ${
                profile?.is_available ? 'bg-success' : 'bg-line'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  profile?.is_available ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </div>

        {/* COD cash-in-hand wallet */}
        {profile && (
          <div className={`bg-white rounded-card shadow-card p-4 mb-6 ${profile.cod_wallet_locked ? 'ring-2 ring-danger' : wallet?.atWarning ? 'ring-2 ring-warning' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">COD cash in hand</span>
              <span className={`text-sm font-bold ${profile.cod_wallet_locked ? 'text-danger' : wallet?.atWarning ? 'text-warning' : 'text-ink'}`}>
                Rs {profile.cod_cash_held.toLocaleString()} / {profile.cod_wallet_limit.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-line overflow-hidden">
              <div
                className={`h-full rounded-full ${profile.cod_wallet_locked ? 'bg-danger' : wallet?.atWarning ? 'bg-warning' : 'bg-success'}`}
                style={{ width: `${wallet?.pct ?? 0}%` }}
              />
            </div>
            {profile.cod_wallet_locked ? (
              <p className="text-xs text-danger mt-2 font-semibold">
                Wallet locked - deposit cash at the hub before accepting new COD parcels.
              </p>
            ) : wallet?.atWarning ? (
              <p className="text-xs text-warning mt-2">Approaching the COD limit - deposit cash soon to avoid a lock.</p>
            ) : null}
          </div>
        )}

        {/* location - manual, one-shot, only visible while online */}
        {profile?.is_available && (
          <div className="bg-white rounded-card shadow-card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className={locationUpdatedAt ? 'text-success' : 'text-muted-foreground'}>{LOCATE_ICON}</span>
              {coords && locationUpdatedAt ? (
                <span className="text-ink">
                  Arrival shared —{' '}
                  <span className="font-mono text-xs text-muted-foreground">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </span>{' '}
                  <span className="text-xs text-muted-foreground">· at {locationUpdatedAt.toLocaleTimeString()}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Tap in once you're at the branch</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {locationError && <span className="text-xs text-danger">{locationError}</span>}
              <button
                onClick={handleArrivedAtBranch}
                disabled={locating}
                className="text-sm font-semibold text-orange hover:opacity-80 disabled:opacity-60 transition-opacity"
              >
                {locating ? 'Sharing…' : "I've arrived at branch"}
              </button>
            </div>
          </div>
        )}

        {/* stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Today's earnings" value={profileLoading ? '—' : `$${(profile?.stats.earnings_today ?? 0).toFixed(2)}`} accent="text-success" />
          <StatCard label="Delivered today" value={profileLoading ? '—' : String(profile?.stats.deliveries_today ?? 0)} accent="text-navy" />
          <StatCard label="Active now" value={profileLoading ? '—' : String(profile?.stats.active_deliveries ?? 0)} accent="text-orange" />
        </div>

        {/* incoming offers */}
        {pendingOffers.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-bold text-ink">Incoming offers</h2>
              <span className="text-xs text-muted-foreground">{pendingOffers.length} waiting</span>
            </div>
            <div className="flex flex-col gap-4 mb-8">
              {pendingOffers.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-card p-5"
                  style={{ boxShadow: '0 0 0 1.5px #F2650D, 0 24px 60px -18px rgba(11,36,114,0.22)' }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-orange">
                        {order.status === 'dest_hub' ? 'Last-mile delivery request' : 'New pickup request'}
                      </span>
                      <p className="font-mono font-bold text-ink mt-1">{order.tracking_number}</p>
                    </div>
                    {(order.final_price ?? order.estimated_price) != null && (
                      <p className="font-display font-bold text-success text-lg whitespace-nowrap">
                        ${(order.final_price ?? order.estimated_price)?.toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-ink mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-navy mt-0.5">{PIN_ICON}</span>
                      <span>{order.pickup_address?.full_address || 'Pickup address unavailable'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-orange mt-0.5">{FLAG_ICON}</span>
                      <span>{order.dropoff_address?.full_address || 'Dropoff address unavailable'}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRespond(order, false)}
                      disabled={respondingId === order.id}
                      className="flex-1 border border-line text-muted-foreground hover:text-danger hover:border-danger font-semibold text-sm py-2.5 rounded-[10px] transition-colors disabled:opacity-60"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleRespond(order, true)}
                      disabled={respondingId === order.id}
                      className="flex-[1.4] bg-orange hover:opacity-90 text-white font-bold text-sm py-2.5 rounded-[10px] transition-opacity disabled:opacity-60"
                    >
                      {respondingId === order.id ? 'Responding…' : 'Accept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* active deliveries */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold text-ink">Active deliveries</h2>
          <span className="text-xs text-muted-foreground">{activeDeliveries.length} assigned</span>
        </div>

        {loadingDeliveries ? (
          <p className="text-muted-foreground text-sm mb-8">Loading deliveries…</p>
        ) : activeDeliveries.length === 0 ? (
          <div className="bg-white rounded-card shadow-card p-6 text-muted-foreground text-sm mb-8">
            No active deliveries right now. New assignments will show up here while you're online.
          </div>
        ) : (
          <div className="flex flex-col gap-4 mb-8">
            {activeDeliveries.map((order) => {
              const nextStatus = STATUS_FLOW[order.status];
              const isHubHeld = HUB_HELD_STATUSES.has(order.status);
              const isOutForDelivery = order.status === 'out_for_delivery';
              return (
                <div key={order.id} className="bg-white rounded-card shadow-card p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="font-mono font-bold text-ink">{order.tracking_number}</p>
                      <span className={`inline-block mt-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[order.status] || 'bg-line text-ink'}`}>
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    {order.final_price != null || order.estimated_price != null ? (
                      <p className="font-display font-bold text-ink text-lg whitespace-nowrap">
                        ${(order.final_price ?? order.estimated_price)?.toFixed(2)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-ink mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-navy mt-0.5">{PIN_ICON}</span>
                      <span>
                        {order.pickup_address?.full_address || 'Pickup address unavailable'}
                        {order.pickup_address?.city ? `, ${order.pickup_address.city}` : ''}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-orange mt-0.5">{FLAG_ICON}</span>
                      <span>
                        {order.dropoff_address?.full_address || 'Dropoff address unavailable'}
                        {order.dropoff_address?.city ? `, ${order.dropoff_address.city}` : ''}
                      </span>
                    </div>
                    {(order.package_description || order.package_weight_kg) && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <span className="mt-0.5">{BOX_ICON}</span>
                        <span>
                          {order.package_description || 'Package'}
                          {order.package_weight_kg ? ` · ${order.package_weight_kg} kg` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {order.dropoff_address?.contact_name || order.dropoff_address?.contact_phone ? (
                    <div className="text-xs text-muted-foreground mb-4">
                      Receiver: {order.dropoff_address?.contact_name || '—'}
                      {order.dropoff_address?.contact_phone ? ` · ${order.dropoff_address.contact_phone}` : ''}
                    </div>
                  ) : null}

                  {isHubHeld && (
                    <p className="text-xs text-muted-foreground italic">With the hub network - nothing to do until it reaches the destination hub.</p>
                  )}

                  {isOutForDelivery && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleReportFailedAttempt(order)}
                        disabled={updatingId === order.id}
                        className="flex-1 border border-line text-muted-foreground hover:text-danger hover:border-danger font-semibold text-sm py-2.5 rounded-[10px] transition-colors disabled:opacity-60"
                      >
                        Report failed attempt
                      </button>
                      <button
                        onClick={() => setDeliveringOrder(order)}
                        className="flex-[1.4] bg-navy hover:bg-navy-light text-white font-bold text-sm py-2.5 rounded-[10px] transition-colors"
                      >
                        Deliver
                      </button>
                    </div>
                  )}

                  {nextStatus && (
                    <button
                      onClick={() => handleAdvanceStatus(order)}
                      disabled={updatingId === order.id}
                      className="w-full sm:w-auto bg-navy hover:bg-navy-light text-white font-bold text-sm px-4 py-2.5 rounded-[10px] disabled:opacity-60 transition-colors"
                    >
                      {updatingId === order.id ? 'Updating…' : STATUS_LABELS[order.status]}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* completed today */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold text-ink">Recently delivered</h2>
        </div>
        {completedDeliveries.length === 0 ? (
          <div className="bg-white rounded-card shadow-card p-6 text-muted-foreground text-sm">
            Nothing delivered yet — completed drop-offs will show up here.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {completedDeliveries.map((order) => (
              <div key={order.id} className="bg-white rounded-card shadow-card px-5 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono font-bold text-ink text-sm">{order.tracking_number}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                    {order.dropoff_address?.full_address || 'Dropoff address unavailable'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(order.final_price ?? order.estimated_price) != null && (
                    <span className="font-display font-bold text-success text-sm">
                      ${(order.final_price ?? order.estimated_price)?.toFixed(2)}
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF7EF] text-success">
                    Delivered
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {deliveringOrder && token && (
        <DeliveryModal
          order={deliveringOrder}
          token={token}
          onClose={() => setDeliveringOrder(null)}
          onDelivered={(updated) => {
            setDeliveries((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            setDeliveringOrder(null);
            loadProfile();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white rounded-card shadow-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className={`font-display text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

/* ------------------------------ delivery modal ------------------------------- */

function DeliveryModal({
  order,
  token,
  onClose,
  onDelivered,
}: {
  order: Order;
  token: string;
  onClose: () => void;
  onDelivered: (order: Order) => void;
}) {
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [recipientName, setRecipientName] = useState(order.dropoff_address?.contact_name || '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSendOtp() {
    setSendingOtp(true);
    setError('');
    try {
      await sendDeliveryOtp(order.id, token);
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send OTP.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleCaptureGps() {
    setLocating(true);
    setError('');
    try {
      setCoords(await getGeolocation());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not capture GPS.');
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    if (!otpCode || !photo || !coords) return;
    setSubmitting(true);
    setError('');
    try {
      const updated = await submitProofOfDelivery(
        order.id,
        { photo, otpCode, lat: coords.lat, lng: coords.lng, recipientName: recipientName || undefined },
        token
      );
      onDelivered(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete delivery.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = otpSent && !!otpCode && !!photo && !!coords && !submitting;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-md sm:rounded-card rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink">Complete delivery</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-ink text-sm font-semibold">Close</button>
        </div>
        <p className="font-mono text-sm text-muted-foreground mb-4">{order.tracking_number}</p>

        {error && <div className="bg-[#FBEAE7] text-danger text-sm rounded-[10px] px-4 py-3 mb-4">{error}</div>}

        <div className="flex flex-col gap-4">
          {/* Step 1: OTP */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">1. Recipient OTP</p>
            {!otpSent ? (
              <button
                onClick={handleSendOtp}
                disabled={sendingOtp}
                className="w-full bg-orange hover:opacity-90 text-white font-bold text-sm py-2.5 rounded-[10px] disabled:opacity-60"
              >
                {sendingOtp ? 'Sending…' : 'Send OTP to recipient'}
              </button>
            ) : (
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit OTP"
                className="w-full border border-line rounded-[10px] px-4 py-2.5 text-sm font-mono tracking-widest"
              />
            )}
          </div>

          {/* Step 2: GPS */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">2. GPS location</p>
            <button
              onClick={handleCaptureGps}
              disabled={locating}
              className={`w-full border font-semibold text-sm py-2.5 rounded-[10px] transition-colors disabled:opacity-60 ${
                coords ? 'border-success text-success' : 'border-line text-ink hover:border-navy'
              }`}
            >
              {locating ? 'Capturing…' : coords ? `Captured (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : 'Capture current location'}
            </button>
          </div>

          {/* Step 3: Photo */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">3. Proof photo</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Received by (optional)</p>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Recipient name"
              className="w-full border border-line rounded-[10px] px-4 py-2.5 text-sm"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-navy hover:bg-navy-light text-white font-bold text-sm py-3 rounded-[10px] disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Completing…' : 'Mark delivered'}
          </button>
          <p className="text-[0.7rem] text-muted-foreground text-center">OTP, photo, and GPS are all required - no exceptions.</p>
        </div>
      </div>
    </div>
  );
}
