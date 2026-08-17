'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Search, Package, MapPin, ShieldCheck } from 'lucide-react';

export default function TrackLandingPage() {
  const router = useRouter();
  const [awb, setAwb] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = awb.trim();
    if (!trimmed) {
      setError('Enter your AWB / tracking number.');
      return;
    }
    router.push(`/track/${encodeURIComponent(trimmed.toUpperCase())}`);
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-white px-6 py-4 md:px-10">
        <Link href="/"><Logo /></Link>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center md:px-10">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF1FC]">
          <Package className="h-7 w-7 text-navy" />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-navy md:text-3xl">Track your parcel</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Enter the AWB / tracking number from your booking confirmation or SMS — no account required.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 w-full max-w-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={awb}
              onChange={(e) => { setAwb(e.target.value); setError(''); }}
              placeholder="e.g. RE12345678"
              autoFocus
              className="h-14 w-full rounded-[14px] border-[1.5px] border-line bg-white pl-12 pr-4 text-base font-semibold uppercase tracking-wide text-ink outline-none focus:border-orange focus:shadow-[0_0_0_3px_rgba(242,101,13,0.13)]"
            />
          </div>
          {error && <p className="mt-2 text-left text-sm text-[#db2203]">{error}</p>}
          <button
            type="submit"
            className="mt-4 h-12 w-full rounded-[12px] bg-navy text-sm font-bold text-white transition-colors hover:bg-navy-light"
          >
            Track shipment
          </button>
        </form>

        <div className="mt-14 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-2">
          <div className="rounded-card border border-line bg-white p-5 shadow-card">
            <MapPin className="mb-2 h-5 w-5 text-[#db2203]" />
            <div className="text-sm font-bold text-ink">Live rider location</div>
            <p className="mt-1 text-xs text-muted-foreground">See your rider on the map once your parcel is out for delivery.</p>
          </div>
          <div className="rounded-card border border-line bg-white p-5 shadow-card">
            <ShieldCheck className="mb-2 h-5 w-5 text-success" />
            <div className="text-sm font-bold text-ink">Full timeline</div>
            <p className="mt-1 text-xs text-muted-foreground">Every scan and status change, from booking to delivery.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
