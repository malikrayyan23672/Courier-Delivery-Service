'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

export interface MapPinData {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  color?: string;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if ((window as any).google?.maps) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

/**
 * Renders pins on Google Maps when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured.
 * Falls back to a simple pin list so the page stays fully functional without a paid key.
 */
export function GoogleMap({
  pins,
  center,
  zoom = 7,
  height = 360,
}: {
  pins: MapPinData[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [failed, setFailed] = useState(!GOOGLE_MAPS_API_KEY);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !containerRef.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const google = (window as any).google;
        const first = pins[0];
        const mapCenter = center || (first ? { lat: first.lat, lng: first.lng } : { lat: 30.3753, lng: 69.3451 }); // Pakistan centroid
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: mapCenter,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
        });
      })
      .catch(() => setFailed(true));

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const google = (window as any).google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = pins.map((pin) => new google.maps.Marker({
      position: { lat: pin.lat, lng: pin.lng },
      map: mapRef.current,
      title: pin.label,
    }));
  }, [pins]);

  if (failed || !GOOGLE_MAPS_API_KEY) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-4" style={{ minHeight: height }}>
        <p className="mb-3 text-xs text-muted-foreground">
          Live map unavailable — set <code className="rounded bg-card px-1 py-0.5">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable Google Maps.
        </p>
        {pins.length === 0 ? (
          <p className="text-sm text-muted-foreground">No locations to show yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {pins.map((pin) => (
              <div key={pin.id} className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: pin.color || '#F2650D' }} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{pin.label}</div>
                  {pin.sublabel && <div className="truncate text-xs text-muted-foreground">{pin.sublabel}</div>}
                  <div className="font-mono text-[0.65rem] text-muted-foreground/70">{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <div ref={containerRef} className="w-full rounded-xl border border-border" style={{ height }} />;
}
