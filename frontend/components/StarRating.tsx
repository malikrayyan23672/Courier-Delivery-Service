'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

export function StarDisplay({ value, size = 16 }: { value: number | null; size?: number }) {
  if (value == null) return <span className="text-xs text-muted-foreground">No ratings yet</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(value) ? 'fill-orange text-orange' : 'text-line'}
        />
      ))}
      <span className="text-xs font-semibold text-ink ml-1">{value.toFixed(1)}</span>
    </span>
  );
}

export function StarPicker({ value, onChange, size = 26 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            className={n <= (hover || value) ? 'fill-orange text-orange' : 'text-line'}
          />
        </button>
      ))}
    </span>
  );
}
