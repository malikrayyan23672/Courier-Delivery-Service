'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { GoogleMap, MapPinData } from '@/components/GoogleMap';
import { ApiError, trackPublicOrder, PublicTrackingInfo } from '@/lib/api';
import { CheckCircle2, Circle, Truck, Search, Phone, Bike } from 'lucide-react';

const STATUS_ORDER = ['created', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TrackAwbPage() {
  const { awb } = useParams<{ awb: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<PublicTrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    if (!awb) return;
    setLoading(true);
    setError('');
    trackPublicOrder(awb)
      .then(setInfo)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not find this tracking number.'))
      .finally(() => setLoading(false));
  }, [awb]);

  function handleReSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchValue.trim()) router.push(`/track/${encodeURIComponent(searchValue.trim().toUpperCase())}`);
  }

  const isOutForDelivery = info?.status === 'out_for_delivery';
  const hasRiderLocation = !!(info?.rider?.latitude && info?.rider?.longitude);
  const currentStepIndex = info ? STATUS_ORDER.indexOf(info.status) : -1;

  const pins: MapPinData[] = hasRiderLocation
    ? [{
        id: 'rider',
        lat: info!.rider!.latitude!,
        lng: info!.rider!.longitude!,
        label: info!.rider!.full_name || 'Your rider',
        sublabel: info!.rider!.vehicle_type ? titleCase(info!.rider!.vehicle_type) : 'On the way',
        color: '#F2650D',
      }]
    : [];

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-white px-6 py-4 md:px-10">
        <Link href="/track"><Logo /></Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10 md:px-10">
        <form onSubmit={handleReSearch} className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Track another AWB…"
              className="h-11 w-full rounded-[10px] border border-line bg-white pl-10 pr-3 text-sm font-medium uppercase outline-none focus:border-orange"
            />
          </div>
          <button type="submit" className="h-11 rounded-[10px] bg-navy px-5 text-sm font-bold text-white hover:bg-navy-light transition-colors">
            Track
          </button>
        </form>

        {loading ? (
          <div className="rounded-card border border-line bg-white p-10 text-center text-sm text-muted-foreground shadow-card">
            Looking up {awb}…
          </div>
        ) : !info ? (
          <div className="rounded-card border border-danger/30 bg-[#FBE9E5] p-8 text-center shadow-card">
            <p className="text-sm font-semibold text-[#db2203]">{error || 'Tracking number not found.'}</p>
            <p className="mt-2 text-xs text-muted-foreground">Double-check the AWB and try again — it's case-insensitive.</p>
          </div>
        ) : (
          <>
            <div className="rounded-card border border-line bg-white p-6 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs font-semibold text-muted-foreground">{info.tracking_number}</div>
                  <h1 className="mt-1 font-display text-xl font-extrabold text-navy">{titleCase(info.status)}</h1>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FBF3EA]">
                  <Truck className="h-5 w-5 text-[#db2203]" />
                </span>
              </div>
              {(info.pickup_city || info.dropoff_city) && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {info.pickup_city || '—'} <span className="mx-1">→</span> {info.dropoff_city || '—'}
                </p>
              )}
            </div>

            {isOutForDelivery && info.rider && (
              <div className="mt-5 rounded-card border border-line bg-white p-5 shadow-card">
                <div className="mb-3 flex items-center gap-2">
                  <Bike className="h-4 w-4 text-[#db2203]" />
                  <h2 className="text-sm font-bold text-ink">Your rider is on the way</h2>
                </div>
                <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{info.rider.full_name || 'Rider assigned'}</div>
                    {info.rider.vehicle_type && <div className="text-xs text-muted-foreground">{titleCase(info.rider.vehicle_type)}</div>}
                  </div>
                  {info.rider.phone && (
                    <a href={`tel:${info.rider.phone}`} className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-light transition-colors">
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  )}
                </div>
                {hasRiderLocation ? (
                  <GoogleMap pins={pins} center={{ lat: info.rider.latitude!, lng: info.rider.longitude! }} zoom={13} height={320} />
                ) : (
                  <p className="text-sm text-muted-foreground">Waiting for the rider's live location…</p>
                )}
              </div>
            )}

            <div className="mt-5 rounded-card border border-line bg-white p-6 shadow-card">
              <h2 className="mb-4 text-sm font-bold text-ink">Timeline</h2>
              <div className="flex flex-col">
                {info.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scan events yet — this parcel has just been booked.</p>
                ) : (
                  info.history
                    .slice()
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((h, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          {i === 0 ? (
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground/40" />
                          )}
                          {i < info.history.length - 1 && <div className="my-1 w-px flex-1 bg-line" />}
                        </div>
                        <div className={`pb-5 ${i === 0 ? '' : 'opacity-70'}`}>
                          <div className="text-sm font-semibold text-ink">{titleCase(h.status)}</div>
                          {h.note && <div className="text-xs text-muted-foreground">{h.note}</div>}
                          <div className="text-[0.7rem] text-muted-foreground/70">{new Date(h.timestamp).toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
