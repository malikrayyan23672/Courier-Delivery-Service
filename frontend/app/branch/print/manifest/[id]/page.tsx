'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { Barcode } from '@/components/Barcode';
import { ApiError, getPublicManifest, BusManifest } from '@/lib/api';
import { Printer, ArrowLeft } from 'lucide-react';

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PrintManifestPage() {
  return (
    <RoleGuard allowedRoles={['staff', 'admin', 'super_admin']}>
      <PrintManifestContent />
    </RoleGuard>
  );
}

function PrintManifestContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [manifest, setManifest] = useState<BusManifest | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getPublicManifest(id)
      .then(setManifest)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this manifest.'));
  }, [id]);

  if (error) return <div className="max-w-lg mx-auto mt-10 text-sm text-[#db2203]">{error}</div>;
  if (!manifest) return <div className="max-w-lg mx-auto mt-10 text-sm text-muted-foreground">Loading…</div>;

  const scannedCount = manifest.items.filter((i) => i.scan_status && i.scan_status !== 'loaded').length;

  return (
    <div className="min-h-screen bg-page">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-line px-6 py-3.5 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm font-semibold text-muted-foreground hover:text-navy flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={() => window.print()} className="text-sm font-bold bg-navy text-white px-4 py-2 rounded-[10px] hover:bg-navy-light transition-colors flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 print:py-0 print:px-0 print:max-w-none">
        <div className="bg-white rounded-card shadow-card print:shadow-none print:rounded-none p-8 print:p-4">
          <div className="flex items-start justify-between mb-6 pb-6 border-b border-line">
            <div>
              <div className="font-display text-lg font-extrabold text-navy leading-none">
                RAFTAAR<span className="text-[#db2203]">EXPRESS</span>
              </div>
              <div className="text-[0.6rem] tracking-[0.2em] text-muted-foreground font-semibold mt-1">BUS MANIFEST</div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FBF3EA] text-[#db2203]">{titleCase(manifest.status || '')}</span>
          </div>

          <div className="flex flex-col items-center mb-6">
            <Barcode value={manifest.manifest_number || manifest.id} height={70} />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground mb-1">Route</p>
              <p className="text-sm font-semibold text-ink">{manifest.origin_city || '—'} → {manifest.destination_city || '—'}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground mb-1">Operator / coach</p>
              <p className="text-sm font-semibold text-ink">{manifest.operator_name || '—'} · {manifest.coach_number || '—'}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground mb-1">Departure</p>
              <p className="text-sm font-semibold text-ink">{manifest.departure_at ? new Date(manifest.departure_at).toLocaleString() : 'Not yet departed'}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground mb-1">Crates</p>
              <p className="text-sm font-semibold text-ink">{scannedCount} / {manifest.items.length} scanned</p>
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted-foreground uppercase">
                <th className="py-2 font-semibold">#</th>
                <th className="py-2 font-semibold">Crate label</th>
                <th className="py-2 font-semibold">Tracking</th>
                <th className="py-2 font-semibold text-right">Scan</th>
              </tr>
            </thead>
            <tbody>
              {manifest.items.map((it, i) => (
                <tr key={it.id} className="border-b border-line">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-mono text-xs text-ink">{it.crate_label || '—'}</td>
                  <td className="py-2 font-mono text-xs text-ink">{it.tracking_number || '—'}</td>
                  <td className="py-2 text-right text-xs text-ink">{titleCase(it.scan_status || 'loaded')}</td>
                </tr>
              ))}
              {manifest.items.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No crates loaded on this manifest.</td></tr>
              )}
            </tbody>
          </table>

          <p className="text-center text-xs text-muted-foreground pt-4 border-t border-line">
            Manifest: <span className="font-mono font-semibold text-ink">{manifest.manifest_number || manifest.id}</span> · Hand to bus operator at departure
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 12mm; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
