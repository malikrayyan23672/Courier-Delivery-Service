'use client';

// Leaflet touches `window`/`document` at import time, so this component must
// stay client-only. BranchConsole loads it via next/dynamic({ ssr: false }).
import 'leaflet/dist/leaflet.css';

import { useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

import type { RiderLocation } from '@/lib/api';

// Webpack/Next don't resolve Leaflet's default marker image paths correctly,
// so the default icon silently renders as a broken image. Point it at the
// package's own CDN-hosted assets instead of bundling copies.
const riderIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Fallback center when there's no rider data and no branch coordinates to
// derive one from: Lahore, Pakistan - this project's default branch city.
const DEFAULT_CENTER: [number, number] = [31.5204, 74.3587];

function centroid(riders: RiderLocation[]): [number, number] | null {
  if (riders.length === 0) return null;
  const sum = riders.reduce(
    (acc, r) => [acc[0] + r.lat, acc[1] + r.lng] as [number, number],
    [0, 0] as [number, number]
  );
  return [sum[0] / riders.length, sum[1] / riders.length];
}

export default function RiderMap({
  riders,
  center,
}: {
  riders: RiderLocation[];
  center?: [number, number];
}) {
  const mapCenter = useMemo(
    () => center ?? centroid(riders) ?? DEFAULT_CENTER,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [riders, center]
  );

  return (
    <MapContainer
      center={mapCenter}
      zoom={riders.length ? 12 : 11}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {riders.map((r) => (
        <Marker key={r.rider_id} position={[r.lat, r.lng]} icon={riderIcon}>
          <Popup>
            <div className="text-sm">
              <div className="font-bold">{r.full_name}</div>
              <div>{r.vehicle_type ?? 'Vehicle unknown'}</div>
              <div>{r.is_available ? 'Available' : 'Unavailable'}</div>
              <div>Rating: {r.rating.toFixed(1)}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
