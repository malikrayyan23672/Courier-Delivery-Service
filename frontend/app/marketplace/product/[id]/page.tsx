'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { StarDisplay } from '@/components/StarRating';
import {
  ApiError,
  getMarketplaceProduct,
  getMyProfile,
  checkoutMarketplaceOrder,
  mediaUrl,
  ProductPublic,
  MyProfile,
} from '@/lib/api';
import { Minus, Plus, ShieldCheck, Truck } from 'lucide-react';

const inputCls = 'w-full text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE] outline-none focus:border-orange transition-colors';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [product, setProduct] = useState<ProductPublic | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online_gateway'>('cash');
  const [discountCode, setDiscountCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  useEffect(() => {
    if (!id) return;
    getMarketplaceProduct(id)
      .then(setProduct)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Product not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!token) return;
    getMyProfile(token).then((p) => {
      setProfile(p);
      setContactName(p.full_name);
      setContactPhone(p.phone);
    }).catch(() => {});
  }, [token]);

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setError('');
    setSubmitting(true);
    try {
      const order = await checkoutMarketplaceOrder(
        {
          product_id: product.id,
          quantity,
          dropoff_address: { full_address: address, city, contact_name: contactName, contact_phone: contactPhone },
          payment_method: paymentMethod,
          discount_code: discountCode || undefined,
          ...(token ? {} : { guest_full_name: guestName, guest_phone: guestPhone }),
        },
        token
      );
      router.push(`/marketplace/order/${order.tracking_number}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place this order.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <Link href="/marketplace" className="text-sm font-semibold text-muted-foreground hover:text-navy transition-colors">← Back to marketplace</Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !product ? (
          <div className="bg-white rounded-card shadow-card p-8 text-center text-danger text-sm">{error || 'Product not found.'}</div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <div className="bg-white rounded-card shadow-card overflow-hidden h-72 md:h-96 flex items-center justify-center">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground text-sm">No image</span>
                )}
              </div>
              <div className="mt-5">
                {product.category && <span className="text-[0.68rem] font-bold uppercase tracking-wide text-orange">{product.category}</span>}
                <h1 className="font-display text-2xl font-extrabold text-navy mt-1">{product.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">Sold by <span className="font-semibold text-ink">{product.seller_name}</span>{product.seller_city ? ` · ${product.seller_city}` : ''}</p>
                <div className="mt-2"><StarDisplay value={product.seller_rating_avg} /> <span className="text-xs text-muted-foreground">({product.seller_rating_count} reviews)</span></div>
                {product.description && <p className="text-sm text-ink mt-4 leading-relaxed">{product.description}</p>}
              </div>
            </div>

            <div className="bg-white rounded-card shadow-card p-6 h-fit">
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-display text-3xl font-extrabold text-navy">Rs {product.price.toLocaleString()}</span>
                <span className={`text-xs font-semibold ${product.stock_quantity > 0 ? 'text-success' : 'text-danger'}`}>
                  {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                </span>
              </div>

              {!token && (
                <div className="bg-[#FBF3EA] border border-orange/25 rounded-[10px] px-3.5 py-2.5 text-xs text-ink mb-4">
                  <Link href="/register" className="text-orange font-bold hover:underline">Sign up</Link> before checking out to unlock login-only discounts on delivery. Guest checkout skips them.
                </div>
              )}

              <form onSubmit={handleBuy} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink">Quantity</span>
                  <div className="flex items-center border border-line rounded-[10px] overflow-hidden">
                    <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="p-2 hover:bg-page"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="px-3 text-sm font-bold w-8 text-center">{quantity}</span>
                    <button type="button" onClick={() => setQuantity((q) => Math.min(product.stock_quantity || 999, q + 1))} className="p-2 hover:bg-page"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {!token && (
                  <div className="grid grid-cols-2 gap-3">
                    <input value={guestName} onChange={(e) => setGuestName(e.target.value)} required placeholder="Your full name" className={inputCls} />
                    <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required placeholder="Phone (03xxxxxxxxx)" className={inputCls} />
                  </div>
                )}

                <input value={contactName} onChange={(e) => setContactName(e.target.value)} required placeholder="Receiver name" className={inputCls} />
                <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required placeholder="Receiver phone" className={inputCls} />
                <input value={address} onChange={(e) => setAddress(e.target.value)} required minLength={5} placeholder="Delivery address" className={inputCls} />
                <input value={city} onChange={(e) => setCity(e.target.value)} required placeholder="City" className={inputCls} />

                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'online_gateway')} className={inputCls}>
                  <option value="cash">Cash on Delivery</option>
                  <option value="online_gateway">Pay online</option>
                </select>

                {token && (
                  <input value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} placeholder="Discount code (optional)" className={inputCls} />
                )}

                {error && <p className="text-sm text-danger">{error}</p>}

                <button
                  disabled={submitting || product.stock_quantity === 0}
                  className="w-full text-sm font-bold px-5 py-3.5 rounded-[10px] bg-orange text-white hover:bg-orange-light disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Placing order…' : `Buy now · Rs ${(product.price * quantity).toLocaleString()}`}
                </button>

                <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Rider pickup from seller</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Tracked door to door</span>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
