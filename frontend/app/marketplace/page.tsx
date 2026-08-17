'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { StarDisplay } from '@/components/StarRating';
import { ApiError, listMarketplaceProducts, listMarketplaceCategories, ProductPublic } from '@/lib/api';
import { Search } from 'lucide-react';

export default function MarketplacePage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<ProductPublic[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listMarketplaceCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const handle = setTimeout(() => {
      listMarketplaceProducts({ q: q || undefined, category: category || undefined })
        .then(setProducts)
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load products.'))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [q, category]);

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between sticky top-0 z-20">
        <Logo />
        <div className="flex items-center gap-3">
          {token ? (
            <Link href="/dashboard" className="text-sm font-semibold text-navy hover:text-orange transition-colors">My account</Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-muted-foreground hover:text-navy transition-colors">Login</Link>
              <Link href="/register" className="text-sm font-bold bg-orange text-white px-4 py-2 rounded-[10px] hover:bg-orange-light transition-colors">Sign up &amp; save</Link>
            </>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl md:text-3xl font-extrabold text-navy">Marketplace</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Buy directly from verified sellers — Raftaar Express picks it up and delivers it.
            {!token && (
              <> <Link href="/register" className="text-orange font-semibold hover:underline">Sign up</Link> for a login-only discount at checkout.</>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="w-full text-sm py-2.5 pl-10 pr-3.5 rounded-[10px] border border-line bg-white outline-none focus:border-orange transition-colors"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-sm py-2.5 px-3.5 rounded-[10px] border border-line bg-white outline-none focus:border-orange transition-colors sm:w-56"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {error && <div className="rounded-lg border border-danger/30 bg-[#FBEAE7] px-4 py-3 text-sm text-danger mb-6">{error}</div>}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-card shadow-card h-64 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-card shadow-card p-10 text-center text-muted-foreground text-sm">
            No products found{q || category ? ' for this search' : ' yet'}.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/marketplace/product/${p.id}`}
                className="bg-white rounded-card shadow-card overflow-hidden flex flex-col hover:-translate-y-0.5 transition-transform"
              >
                <div className="h-40 bg-page flex items-center justify-center overflow-hidden">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-muted-foreground text-xs">No image</span>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-1.5 flex-1">
                  {p.category && <span className="text-[0.68rem] font-bold uppercase tracking-wide text-orange">{p.category}</span>}
                  <h3 className="font-bold text-ink text-sm leading-snug line-clamp-2">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.seller_name}{p.seller_city ? ` · ${p.seller_city}` : ''}</p>
                  <StarDisplay value={p.seller_rating_avg} size={13} />
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <span className="font-display font-extrabold text-navy">Rs {p.price.toLocaleString()}</span>
                    <span className={`text-xs font-semibold ${p.stock_quantity > 0 ? 'text-success' : 'text-danger'}`}>
                      {p.stock_quantity > 0 ? 'In stock' : 'Out of stock'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
