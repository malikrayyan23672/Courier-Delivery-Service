'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export function Barcode({ value, height = 60, className }: { value: string; height?: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    JsBarcode(ref.current, value, {
      format: 'CODE128',
      height,
      width: 2,
      fontSize: 14,
      margin: 8,
      background: '#FFFFFF',
      lineColor: '#0B2472',
    });
  }, [value, height]);

  return <svg ref={ref} className={className} />;
}
