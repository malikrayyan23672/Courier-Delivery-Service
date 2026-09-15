'use client';

import { useState } from 'react';
import { CameraScanButton } from '@/components/CameraScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HubScanAction, HubScanResult, ApiError } from '@/lib/api';

/**
 * Shared scan-to-change-status console used by the staff, branch, hub and
 * local-office portals. Captures a tracking number (typed or via the
 * camera/barcode gun) and drives it through the facility hierarchy via the
 * scan actions:
 *   in       -> receive into this facility (level-aware)
 *   out      -> move up one level toward the bus
 *   arrive   -> bus arrival (-> dest_hub)
 *   transfer -> advance one step along the full route
 *   dispatch -> start last-mile delivery (-> out_for_delivery)
 * The actual API call is injected so the same UI works for every portal.
 */
export function ScanConsole({
  scanFn,
  description,
  showTransfer = true,
}: {
  scanFn: (trackingNumber: string, action: HubScanAction) => Promise<HubScanResult>;
  description?: string;
  showTransfer?: boolean;
}) {
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState<HubScanAction | null>(null);
  const [result, setResult] = useState<HubScanResult | null>(null);
  const [error, setError] = useState('');

  async function doScan(action: HubScanAction) {
    if (!tracking.trim()) {
      setError('Enter or scan a tracking number first.');
      return;
    }
    setBusy(action);
    setError('');
    try {
      const res = await scanFn(tracking.trim().toUpperCase(), action);
      setResult(res);
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : 'Scan failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {description && <p className="text-muted-foreground text-sm mb-6">{description}</p>}

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Tracking number (e.g. RFXXXXXX)"
          className="font-mono"
        />
        <CameraScanButton onScan={(v) => setTracking(v)} label="Scan barcode" />
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button variant="navy" disabled={busy !== null} onClick={() => doScan('in')}>
          {busy === 'in' ? 'Scanning…' : 'Scan In (receive)'}
        </Button>
        <Button variant="outline" disabled={busy !== null} onClick={() => doScan('out')}>
          {busy === 'out' ? 'Scanning…' : 'Move Up (→ next level)'}
        </Button>
        <Button variant="outline" disabled={busy !== null} onClick={() => doScan('arrive')}>
          {busy === 'arrive' ? 'Scanning…' : 'Bus Arrive (→ Dest Hub)'}
        </Button>
        {showTransfer && (
          <Button variant="outline" disabled={busy !== null} onClick={() => doScan('transfer')}>
            {busy === 'transfer' ? 'Scanning…' : 'Transfer (→ next step)'}
          </Button>
        )}
        <Button variant="outline" disabled={busy !== null} onClick={() => doScan('dispatch')}>
          {busy === 'dispatch' ? 'Scanning…' : 'Dispatch (→ Delivery)'}
        </Button>
      </div>

      {error && <p className="text-sm text-[#db2203] mt-4">{error}</p>}

      {result && (
        <div className="bg-[#EAF7EF] border border-success/30 rounded-[10px] px-5 py-4 mt-6">
          <p className="font-bold text-success">
            {result.tracking_number} — {result.status.replace('_', ' ')}
          </p>
          <p className="text-sm text-ink mt-1">{result.note}</p>
          {result.dropoff_city && (
            <p className="text-xs text-muted-foreground mt-1">Destination: {result.dropoff_city}</p>
          )}
        </div>
      )}
    </div>
  );
}
