'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  Order,
  RiderMe,
  ApiError,
} from '@/lib/api';

// Minimum time between location PATCH calls to the backend. watchPosition can fire
// far more often than this (especially with enableHighAccuracy) - without a throttle
// we'd hammer the API and cause frequent state updates for no visible benefit.
const LOCATION_SEND_INTERVAL_MS = 15000;

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
  assigned: 'Mark picked up',
  picked_up: 'Mark in transit',
  in_transit: 'Mark delivered',
};

const STATUS_BADGE: Record<string, string> = {
  created: 'bg-[#EAF1FC] text-navy',
  assigned: 'bg-[#EAF1FC] text-navy',
  picked_up: 'bg-[#FBF3EA] text-orange',
  in_transit: 'bg-[#FBF3EA] text-orange',
  delivered: 'bg-[#EAF7EF] text-success',
  failed: 'bg-[#FBEAE7] text-danger',
  cancelled: 'bg-[#F0F0F0] text-muted',
};

const ACTIVE_STATUSES = new Set(['assigned', 'picked_up', 'in_transit']);

function statusLabel(status: string) {
  return status.replace('_', ' ');
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
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

  // Live location tracking - kept in its own isolated state so a GPS ping never
  // touches `deliveries`/`profile`/the loading flags, and therefore never causes
  // the delivery list or profile card to flicker/re-render.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<Date | null>(null);
  const [locationError, setLocationError] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!token) return;
    loadProfile();
    loadDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Start/stop the GPS watch whenever the rider's online status changes - not on
  // every render, and not tied to anything that re-fetches deliveries or profile.
  useEffect(() => {
    if (profile?.is_available) {
      startWatchingLocation();
    } else {
      stopWatchingLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.is_available]);

  useEffect(() => {
    return () => stopWatchingLocation(); // safety net on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startWatchingLocation() {
    if (watchIdRef.current != null) return; // already watching
    if (!('geolocation' in navigator)) {
      setLocationError("This device/browser doesn't support location sharing.");
      return;
    }
    setLocationError('');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next); // cheap local state, no refetch triggered

        const now = Date.now();
        if (now - lastSentAtRef.current < LOCATION_SEND_INTERVAL_MS) return;
        lastSentAtRef.current = now;

        const currentToken = tokenRef.current;
        if (!currentToken) return;
        updateRiderLocation(next.lat, next.lng, currentToken)
          .then(() => setLocationUpdatedAt(new Date()))
          .catch(() => {}); // silent - a dropped background ping shouldn't flash an error banner
      },
      () => setLocationError('Location permission denied - turn it on to share live location.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  }

  function stopWatchingLocation() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
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
        setDeliveries((prev) => prev.map((o) => (o.id === order.id ? { ...o, rider_accepted: true } : o)));
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
      await updateDeliveryStatus(order.id, nextStatus, undefined, token);
      setDeliveries((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));
      loadProfile(); // stats (earnings/active count) may have changed
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

  const pendingOffers = useMemo(
    () => deliveries.filter((o) => o.status === 'assigned' && o.rider_accepted !== true),
    [deliveries]
  );
  const activeDeliveries = useMemo(
    () =>
      deliveries.filter(
        (o) => ACTIVE_STATUSES.has(o.status) && !(o.status === 'assigned' && o.rider_accepted !== true)
      ),
    [deliveries]
  );
  const completedDeliveries = useMemo(
    () => deliveries.filter((o) => o.status === 'delivered').slice(0, 5),
    [deliveries]
  );

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
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
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
            <span className={`text-sm font-semibold ${profile?.is_available ? 'text-success' : 'text-muted'}`}>
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

        {/* live location - isolated state, updates here never touch the delivery list below */}
        {profile?.is_available && (
          <div className="bg-white rounded-card shadow-card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className={locationUpdatedAt ? 'text-success' : 'text-muted'}>{LOCATE_ICON}</span>
              {coords && locationUpdatedAt ? (
                <span className="text-ink">
                  Sharing live location —{' '}
                  <span className="font-mono text-xs text-muted">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </span>{' '}
                  <span className="text-xs text-muted">· updated {locationUpdatedAt.toLocaleTimeString()}</span>
                </span>
              ) : (
                <span className="text-muted">Getting your location…</span>
              )}
            </div>
            {locationError && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-danger">{locationError}</span>
                <button
                  onClick={startWatchingLocation}
                  className="text-sm font-semibold text-orange hover:opacity-80 transition-opacity"
                >
                  Retry
                </button>
              </div>
            )}
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
              <span className="text-xs text-muted">{pendingOffers.length} waiting</span>
            </div>
            <div className="flex flex-col gap-4 mb-8">
              {pendingOffers.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-card p-5"
                  style={{ boxShadow: '0 0 0 1.5px #F2701A, 0 24px 60px -18px rgba(15,38,72,0.22)' }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-orange">New delivery request</span>
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
                      className="flex-1 border border-line text-muted hover:text-danger hover:border-danger font-semibold text-sm py-2.5 rounded-[10px] transition-colors disabled:opacity-60"
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
          <span className="text-xs text-muted">{activeDeliveries.length} assigned</span>
        </div>

        {loadingDeliveries ? (
          <p className="text-muted text-sm mb-8">Loading deliveries…</p>
        ) : activeDeliveries.length === 0 ? (
          <div className="bg-white rounded-card shadow-card p-6 text-muted text-sm mb-8">
            No active deliveries right now. New assignments will show up here while you're online.
          </div>
        ) : (
          <div className="flex flex-col gap-4 mb-8">
            {activeDeliveries.map((order) => {
              const nextStatus = STATUS_FLOW[order.status];
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
                      <div className="flex items-start gap-2 text-muted">
                        <span className="mt-0.5">{BOX_ICON}</span>
                        <span>
                          {order.package_description || 'Package'}
                          {order.package_weight_kg ? ` · ${order.package_weight_kg} kg` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {order.dropoff_address?.contact_name || order.dropoff_address?.contact_phone ? (
                    <div className="text-xs text-muted mb-4">
                      Receiver: {order.dropoff_address?.contact_name || '—'}
                      {order.dropoff_address?.contact_phone ? ` · ${order.dropoff_address.contact_phone}` : ''}
                    </div>
                  ) : null}

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
          <div className="bg-white rounded-card shadow-card p-6 text-muted text-sm">
            Nothing delivered yet — completed drop-offs will show up here.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {completedDeliveries.map((order) => (
              <div key={order.id} className="bg-white rounded-card shadow-card px-5 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono font-bold text-ink text-sm">{order.tracking_number}</p>
                  <p className="text-xs text-muted truncate max-w-xs">
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
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white rounded-card shadow-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">{label}</p>
      <p className={`font-display text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}