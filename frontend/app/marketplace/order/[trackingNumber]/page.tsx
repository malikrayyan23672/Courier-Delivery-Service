'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Barcode } from '@/components/Barcode';
import { StarPicker } from '@/components/StarRating';
import {
  ApiError,
  getMarketplaceOrderByTracking,
  trackPublicOrder,
  submitMarketplaceRating,
  MarketplaceOrder,
  PublicTrackingInfo,
} from '@/lib/api';
import { CheckCircle2, Package } from 'lucide-react';

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MarketplaceOrderPage() {
  const { trackingNumber } = useParams<{ trackingNumber: string }>();
  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [tracking, setTracking] = useState<PublicTrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ratePhone, setRatePhone] = useState('');
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [rateBusy, setRateBusy] = useState(false);
  const [rateDone, setRateDone] = useState(false);
  const [rateError, setRateError] = useState('');

  useEffect(() => {
    if (!trackingNumber) return;
    Promise.all([getMarketplaceOrderByTracking(trackingNumber), trackPublicOrder(trackingNumber)])
      .then(([o, t]) => { setOrder(o); setTracking(t); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Order not found.'))
      .finally(() => setLoading(false));
  }, [trackingNumber]);

  async function handleRate(e: React.FormEvent) {
    e.preventDefault();
    if (!order || score === 0) return;
    setRateBusy(true);
    setRateError('');
    try {
      await submitMarketplaceRating({ order_id: order.id, score, comment: comment || undefined, rater_phone: ratePhone || undefined });
      setRateDone(true);
    } catch (err) {
      setRateError(err instanceof ApiError ? err.message : 'Could not submit rating.');
    } finally {
      setRateBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <Link href="/marketplace" className="text-sm font-semibold text-muted-foreground hover:text-navy transition-colors">Continue shopping →</Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 md:px-10 py-10">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !order ? (
          <div className="bg-white rounded-card shadow-card p-8 text-center text-[#db2203] text-sm">{error || 'Order not found.'}</div>
        ) : (
          <>
            <div className="bg-white rounded-card shadow-card p-6 mb-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
              <h1 className="font-display text-xl font-extrabold text-navy">Order placed!</h1>
              <p className="text-sm text-muted-foreground mt-1">A rider will collect your parcel from the seller and bring it your way.</p>
            </div>

            <div className="bg-white rounded-card shadow-card p-6 mb-6">
              <h2 className="font-bold text-ink text-sm mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Packing slip &amp; barcode</h2>
              <div className="border border-line rounded-[10px] p-4 flex flex-col items-center bg-white">
                <Barcode value={order.tracking_number} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Tracking number</dt><dd className="font-mono font-semibold text-ink">{order.tracking_number}</dd>
                <dt className="text-muted-foreground">Item</dt><dd className="text-ink">{order.quantity} × {order.product_name}</dd>
                <dt className="text-muted-foreground">Seller</dt><dd className="text-ink">{order.seller_name}</dd>
                <dt className="text-muted-foreground">Deliver to</dt><dd className="text-ink">{order.dropoff_full_address}</dd>
                <dt className="text-muted-foreground">Goods</dt><dd className="text-ink">Rs {order.goods_amount.toLocaleString()}</dd>
                <dt className="text-muted-foreground">Delivery fee</dt><dd className="text-ink">Rs {order.delivery_fee.toLocaleString()}</dd>
                {!!order.discount_amount && (<><dt className="text-muted-foreground">Discount</dt><dd className="text-success">- Rs {order.discount_amount.toLocaleString()}</dd></>)}
                <dt className="text-muted-foreground font-semibold">Total</dt><dd className="font-bold text-navy">Rs {(order.final_price ?? 0).toLocaleString()}</dd>
              </dl>
            </div>

            <div className="bg-white rounded-card shadow-card p-6 mb-6">
              <h2 className="font-bold text-ink text-sm mb-3">Tracking</h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#db2203]" />
                  <span className="text-sm font-semibold text-ink">{titleCase(order.status)}</span>
                </div>
                {(tracking?.history ?? []).slice().reverse().map((h, i) => (
                  <div key={i} className="flex items-center gap-2 pl-4 border-l border-line ml-0.5">
                    <span className="text-xs text-muted-foreground">{titleCase(h.status)} — {new Date(h.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {order.status === 'delivered' && (
              <div className="bg-white rounded-card shadow-card p-6">
                <h2 className="font-bold text-ink text-sm mb-3">Rate your experience with {order.seller_name}</h2>
                {rateDone ? (
                  <p className="text-sm text-success">Thanks for the feedback!</p>
                ) : (
                  <form onSubmit={handleRate} className="space-y-3">
                    <StarPicker value={score} onChange={setScore} />
                    <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave a comment (optional)" className="w-full text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE] outline-none focus:border-orange" />
                    <input value={ratePhone} onChange={(e) => setRatePhone(e.target.value)} placeholder="Phone this order was placed under (if you weren't logged in)" className="w-full text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE] outline-none focus:border-orange" />
                    {rateError && <p className="text-sm text-[#db2203]">{rateError}</p>}
                    <button disabled={rateBusy || score === 0} className="text-sm font-bold px-5 py-2.5 rounded-[10px] bg-navy text-white hover:bg-navy-light disabled:opacity-50 transition-colors">
                      {rateBusy ? 'Submitting…' : 'Submit rating'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
