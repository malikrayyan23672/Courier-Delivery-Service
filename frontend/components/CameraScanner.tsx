'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScanLine } from 'lucide-react';

/**
 * Camera-based barcode scan button + modal. A physical USB/Bluetooth scanner
 * gun already works with any plain text input (it just "types" the decoded
 * value), so this exists for hub staff on a tablet/phone with no hardware
 * scanner attached - point the camera, it fills the field for you.
 */
export function CameraScanButton({ onScan, label = 'Scan with camera' }: { onScan: (value: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2.5 rounded-[10px] border border-line text-navy hover:border-navy transition-colors"
      >
        <ScanLine className="w-4 h-4" /> {label}
      </button>
      <CameraScannerDialog
        open={open}
        onOpenChange={setOpen}
        onScan={(v) => { onScan(v); setOpen(false); }}
      />
    </>
  );
}

export function CameraScannerDialog({
  open, onOpenChange, onScan,
}: { open: boolean; onOpenChange: (v: boolean) => void; onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !videoRef.current) return;
    setError('');
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current, (result, err) => {
        if (cancelled) return;
        if (result) onScan(result.getText());
        // `err` fires continuously while no barcode is in frame - not a real error, ignore it.
      })
      .then((controls) => { if (!cancelled) controlsRef.current = controls; else controls.stop(); })
      .catch(() => setError('Could not access the camera. Check permissions, or type the tracking number instead.'));

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onScan]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan barcode</DialogTitle>
          <DialogDescription>Point the camera at the AWB barcode on the parcel or packing slip.</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <div className="rounded-xl overflow-hidden bg-black aspect-video relative">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 border-2 border-orange rounded-lg pointer-events-none" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
