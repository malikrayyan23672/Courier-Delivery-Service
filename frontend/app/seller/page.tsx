'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { cn } from '@/lib/utils';
import {
  ApiError,
  getSellerMe,
  getSellerSettlements,
  getSellerSettlementSummary,
  getSellerTransactions,
  getSellerAnalytics,
  uploadSellerFile,
  listSellerUploads,
  registerRNP,
  listSellerRNP,
  listSellerProducts,
  createSellerProduct,
  updateSellerProduct,
  uploadSellerProductImage,
  mediaUrl,
  listSellerMarketplaceOrders,
  getSellerRatings,
  bookSellerOrder,
  listSellerParcels,
  getSellerParcelDetail,
  bulkUploadTemplateUrl,
  previewBulkUpload,
  confirmBulkUpload,
  listSellerReturns,
  SellerMe,
  SellerSettlement,
  SellerUpload,
  WalletTransaction,
  RNP,
  SellerAnalytics,
  Product,
  SellerMarketplaceOrder,
  RatingSummary,
  SellerParcelRow,
  SellerParcelDetail,
  BulkUploadPreview,
  BulkUploadRowPreview,
  BulkUploadRow,
  SellerReturnRow,
  Order,
} from '@/lib/api';
import { ChartCard } from '@/components/charts/ChartCard';
import { TrendLine } from '@/components/charts/TrendLine';
import { StatusDonut } from '@/components/charts/StatusDonut';
import { STATUS as STATUS_COLORS } from '@/components/charts/palette';
import { Barcode } from '@/components/Barcode';
import { StarDisplay } from '@/components/StarRating';
import { ProductImageUpload } from '@/components/ImageUpload';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Activity, AlertTriangle, BarChart3, Bell, ChevronDown, ChevronRight, CircleDollarSign,
  ImagePlus, LayoutDashboard, Loader2, LogOut, MapPin, Menu, Package, PackagePlus, PackageSearch,
  Printer, Settings, Store, Truck, Undo2, Upload, X,
} from 'lucide-react';

type View = 'overview' | 'analytics' | 'settlements' | 'files' | 'rnp' | 'marketplace' | 'book' | 'parcels' | 'returns';

const NAV_SECTIONS: { label: string; items: { view: View; label: string; icon: React.ReactNode }[] }[] = [
  { label: 'Command', items: [
    { view: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { view: 'marketplace', label: 'Marketplace', icon: <Store className="h-4 w-4" /> },
    { view: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
  ]},
  { label: 'Shipping', items: [
    { view: 'book', label: 'Book Shipment', icon: <PackagePlus className="h-4 w-4" /> },
    { view: 'parcels', label: 'Parcels', icon: <PackageSearch className="h-4 w-4" /> },
    { view: 'files', label: 'Bulk Orders', icon: <Upload className="h-4 w-4" /> },
    { view: 'returns', label: 'Returns / RTO', icon: <Undo2 className="h-4 w-4" /> },
  ]},
  { label: 'Financials', items: [
    { view: 'settlements', label: 'COD Ledger', icon: <CircleDollarSign className="h-4 w-4" /> },
  ]},
  { label: 'Operations', items: [
    { view: 'rnp', label: 'RNP Points', icon: <MapPin className="h-4 w-4" /> },
  ]},
];

const PAGE_META: Record<View, { title: string; sub: string }> = {
  overview: { title: 'Overview', sub: 'Total shipments, delivered, RTO and COD pending' },
  marketplace: { title: 'Marketplace', sub: 'Products, orders and buyer ratings' },
  analytics: { title: 'Analytics', sub: 'Shipment volume and RTO rate' },
  book: { title: 'Book Shipment', sub: 'Single parcel - AWB generated instantly' },
  parcels: { title: 'Parcels', sub: 'Every parcel booked through this seller account' },
  returns: { title: 'Returns / RTO', sub: 'Failed deliveries awaiting return, with SLA countdown' },
  settlements: { title: 'COD Ledger', sub: 'Per-parcel COD: collected, reconciled, paid + payout history' },
  files: { title: 'Bulk Orders', sub: 'CSV template, validate, preview, confirm' },
  rnp: { title: 'RNP Points', sub: 'Your neighbourhood drop / pick-up nodes' },
};

export default function SellerPage() {
  return (
    <RoleGuard allowedRoles={['business']}>
      <SellerContent />
    </RoleGuard>
  );
}

function SellerContent() {
  const { token, setToken } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<View>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [me, setMe] = useState<SellerMe | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [mpOrders, setMpOrders] = useState<SellerMarketplaceOrder[]>([]);
  const [syncing, setSyncing] = useState(true);

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  useEffect(() => {
    if (!token) return;
    setSyncing(true);
    Promise.all([getSellerMe(token), listSellerProducts(token), listSellerMarketplaceOrders(token)])
      .then(([m, p, o]) => { setMe(m); setProducts(p); setMpOrders(o); })
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, [token]);

  function switchView(v: View) {
    setView(v);
    setSidebarOpen(false);
  }

  const stats = useMemo(() => {
    const pendingOrders = mpOrders.filter((o) => o.status === 'created').length;
    const outOfStock = products.filter((p) => p.is_active && p.stock_quantity === 0).length;
    return { pendingOrders, outOfStock, productCount: products.length };
  }, [mpOrders, products]);

  const alerts = useMemo(() => {
    const list: { id: string; icon: React.ReactNode; tone: string; text: string }[] = [];
    if (stats.pendingOrders > 0) list.push({ id: 'pending', icon: <Package className="h-3.5 w-3.5" />, tone: 'text-orange bg-[#FBF3EA]', text: `${stats.pendingOrders} order(s) awaiting packing` });
    if (stats.outOfStock > 0) list.push({ id: 'stock', icon: <AlertTriangle className="h-3.5 w-3.5" />, tone: 'text-danger bg-[#FBE9E5]', text: `${stats.outOfStock} product(s) out of stock` });
    if (me && !me.verified) list.push({ id: 'verify', icon: <AlertTriangle className="h-3.5 w-3.5" />, tone: 'text-orange bg-[#FBF3EA]', text: 'Phone number not verified yet' });
    return list;
  }, [stats, me]);

  const initials = (me?.company_name || 'SP').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* ============ SIDEBAR ============ */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy text-white transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/90">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-display text-base font-extrabold leading-none tracking-tight">
                RAFTAAR<span className="text-primary">EXPRESS</span>
              </div>
              <div className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-white/50">
                Seller Portal
              </div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Separator className="bg-white/10" />

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="px-3 pb-1.5 text-[0.68rem] font-bold uppercase tracking-wider text-white/40">
                  {section.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => {
                    const active = view === item.view;
                    return (
                      <button
                        key={item.view}
                        onClick={() => switchView(item.view)}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <span className={cn(active ? 'text-white' : 'text-white/50 group-hover:text-white/80')}>
                          {item.icon}
                        </span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.view === 'marketplace' && stats.pendingOrders > 0 && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[0.65rem] font-bold text-primary">
                            {stats.pendingOrders}
                          </span>
                        )}
                        {active && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* ============ SIDEBAR PULSE ============ */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-3.5">
            <div className="flex items-center gap-2 pb-3">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wide text-white/70">Store Pulse</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg bg-white/5 px-2.5 py-2">
                <div className="text-[0.65rem] font-medium uppercase tracking-wide text-white/40">Products</div>
                <div className="mt-0.5 text-lg font-bold leading-none">{syncing ? <Skeleton className="h-5 w-10 bg-white/10" /> : stats.productCount}</div>
              </div>
              <div className="rounded-lg bg-white/5 px-2.5 py-2">
                <div className="text-[0.65rem] font-medium uppercase tracking-wide text-white/40">Awaiting pack</div>
                <div className="mt-0.5 text-lg font-bold leading-none text-primary">{syncing ? <Skeleton className="h-5 w-10 bg-white/10" /> : stats.pendingOrders}</div>
              </div>
              <div className="rounded-lg bg-white/5 px-2.5 py-2">
                <div className="text-[0.65rem] font-medium uppercase tracking-wide text-white/40">Wallet</div>
                <div className="mt-0.5 text-lg font-bold leading-none text-success">{syncing ? <Skeleton className="h-5 w-10 bg-white/10" /> : `Rs ${(me?.wallet_balance || 0).toLocaleString()}`}</div>
              </div>
              <div className="rounded-lg bg-white/5 px-2.5 py-2">
                <div className="text-[0.65rem] font-medium uppercase tracking-wide text-white/40">COD</div>
                <div className="mt-0.5 text-lg font-bold leading-none">{syncing ? <Skeleton className="h-5 w-10 bg-white/10" /> : (me?.cod_service ? 'On' : 'Off')}</div>
              </div>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', a.tone)}>{a.icon}</span>
                  <span className="text-xs font-medium text-white/80">{a.text}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-xs font-bold text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{me?.company_name ?? 'Seller'}</div>
              <div className="truncate text-[0.7rem] text-white/50">{me?.email ?? '—'}</div>
            </div>
            <button onClick={handleLogout} title="Log out" className="p-1.5 text-white/50 hover:text-white transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ============ MAIN ============ */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-5 py-3.5 backdrop-blur md:px-8">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-ink hover:bg-muted rounded-lg">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Raftaar Express</span>
              <ChevronRight className="h-3 w-3" />
              <span className="font-semibold text-ink">{PAGE_META[view].title}</span>
            </div>
            <h1 className="truncate font-display text-lg font-bold text-ink leading-tight">{PAGE_META[view].title}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{PAGE_META[view].sub}</p>
          </div>

          <TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="h-5 w-5" />
                      {alerts.length > 0 && (
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Notifications</TooltipContent>
                </Tooltip>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {alerts.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">All clear — nothing needs attention.</div>
                ) : (
                  alerts.map((a) => (
                    <DropdownMenuItem key={a.id} className="gap-3">
                      <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', a.tone)}>{a.icon}</span>
                      <span className="text-sm">{a.text}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-navy text-xs font-bold text-white">{initials}</AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{me?.company_name ?? 'Seller'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => switchView('overview')}>
                <Settings className="mr-2 h-4 w-4" /> Account overview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="p-5 md:p-8">
          {view === 'overview' && <OverviewTab token={token!} onNavigate={switchView} />}
          {view === 'marketplace' && <MarketplaceTab token={token!} />}
          {view === 'analytics' && <AnalyticsTab token={token!} />}
          {view === 'book' && <BookShipmentTab token={token!} />}
          {view === 'parcels' && <ParcelsTab token={token!} />}
          {view === 'returns' && <ReturnsTab token={token!} />}
          {view === 'settlements' && <SettlementsTab token={token!} />}
          {view === 'files' && <FilesTab token={token!} />}
          {view === 'rnp' && <RnpTab token={token!} />}
        </main>
      </div>
    </div>
  );
}

function OverviewTab({ token, onNavigate }: { token: string; onNavigate: (v: View) => void }) {
  const [me, setMe] = useState<SellerMe | null>(null);
  const [summary, setSummary] = useState<{ pending_count: number; pending_amount: number } | null>(null);
  const [analytics, setAnalytics] = useState<SellerAnalytics | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getSellerMe(token), getSellerSettlementSummary(token), getSellerTransactions(token), getSellerAnalytics(token)])
      .then(([m, s, t, a]) => {
        setMe(m);
        setSummary(s);
        setTxns(t);
        setAnalytics(a);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your account.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-muted-foreground text-sm">Loading your portal…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!me) return null;

  const delivered = analytics?.status_counts.delivered ?? 0;
  const rto = analytics?.status_counts.rto ?? 0;

  return (
    <div>
      {!me.verified && (
        <div className="mb-6 bg-[#FBF3EA] border border-orange/20 rounded-card px-5 py-3 text-sm text-orange font-semibold">
          Your phone number is not verified yet — please verify via OTP to fully activate your seller account.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Shipments</p>
          <p className="text-2xl font-bold text-navy mt-1">{analytics?.total_shipments ?? 0}</p>
        </div>
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivered</p>
          <p className="text-2xl font-bold text-success mt-1">{delivered}</p>
        </div>
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">RTO</p>
          <p className="text-2xl font-bold text-danger mt-1">{rto}</p>
          <p className="text-xs text-muted-foreground mt-1">{analytics?.rto_rate ?? 0}% RTO rate</p>
        </div>
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">COD Pending</p>
          <p className="text-2xl font-bold text-orange mt-1">Rs {(summary?.pending_amount || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{summary?.pending_count ?? 0} orders</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wallet balance</p>
          <p className="text-2xl font-bold text-ink mt-1">{(me.wallet_balance || 0).toLocaleString()} PKR</p>
          {me.wallet_locked && (
            <p className="text-xs text-danger font-semibold mt-1">
              Wallet locked{me.wallet_lock_reason ? ` · ${me.wallet_lock_reason}` : ''}
            </p>
          )}
        </div>
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending COD payouts</p>
          <p className="text-2xl font-bold text-ink mt-1">{(summary?.pending_amount || 0).toLocaleString()} PKR</p>
          <p className="text-xs text-muted-foreground mt-1">{summary?.pending_count ?? 0} orders · T+1 next-morning payout</p>
        </div>
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business</p>
          <p className="text-lg font-bold text-ink mt-1 truncate">{me.company_name}</p>
          <p className="text-xs text-muted-foreground mt-1">{me.business_type || '—'} · COD {me.cod_service ? 'enabled' : 'disabled'}</p>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h3 className="font-bold text-ink">Recent wallet activity</h3>
          <button onClick={() => onNavigate('settlements')} className="text-sm font-semibold text-orange hover:text-orange-light">
            View payouts
          </button>
        </div>
        {txns.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">No wallet transactions yet. COD payouts appear here after settlement.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {txns.slice(0, 8).map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3.5 text-muted-foreground capitalize">{t.transaction_type?.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-3.5 font-semibold text-ink">
                    <span className={t.amount >= 0 ? 'text-success' : 'text-danger'}>
                      {t.amount >= 0 ? '+' : ''}{t.amount}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground text-xs">{t.reference || '—'}</td>
                  <td className="px-6 py-3.5 text-muted-foreground text-xs">
                    {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AnalyticsTab({ token }: { token: string }) {
  const [data, setData] = useState<SellerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSellerAnalytics(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load analytics.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-muted-foreground text-sm">Loading analytics…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return null;

  const statusData = Object.entries(data.status_counts).map(([status, value]) => ({ label: status.replace(/_/g, ' '), value }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total shipments</p>
          <p className="text-2xl font-bold text-ink mt-1">{data.total_shipments}</p>
        </div>
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">RTO rate</p>
          <p className="text-2xl font-bold mt-1" style={{ color: data.rto_rate > 15 ? STATUS_COLORS.critical : STATUS_COLORS.good }}>{data.rto_rate}%</p>
        </div>
      </div>

      <ChartCard title="Shipments — last 14 days" empty={data.daily_shipments.length === 0} emptyMessage="No shipments in this period yet.">
        <TrendLine data={data.daily_shipments} xKey="date" series={[{ key: 'shipments', label: 'Shipments' }]} />
      </ChartCard>

      <ChartCard title="Shipments by status" empty={statusData.length === 0}>
        <StatusDonut data={statusData} centerLabel={{ value: String(data.total_shipments), caption: 'shipments' }} />
      </ChartCard>
    </div>
  );
}

function SettlementsTab({ token }: { token: string }) {
  const [rows, setRows] = useState<SellerSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSellerSettlements(token)
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load payouts.'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <h3 className="font-bold text-ink">COD payouts — guaranteed next morning (T+1)</h3>
      </div>
      {loading ? (
        <p className="p-6 text-muted-foreground text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-muted-foreground text-sm">No COD payouts yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted-foreground">
              <th className="px-6 py-3 font-semibold">Tracking</th>
              <th className="px-6 py-3 font-semibold">Amount</th>
              <th className="px-6 py-3 font-semibold">Due (T+1)</th>
              <th className="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-6 py-3.5 font-mono">{s.tracking_number || '—'}</td>
                <td className="px-6 py-3.5 font-semibold">{s.amount.toLocaleString()} PKR</td>
                <td className="px-6 py-3.5 text-muted-foreground">
                  {s.settle_due_on ? new Date(s.settle_due_on).toDateString() : '—'}
                </td>
                <td className="px-6 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    s.status === 'paid' ? 'bg-[#EAF7EF] text-success' : 'bg-[#FBF3EA] text-orange'
                  }`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FilesTab({ token }: { token: string }) {
  const [uploads, setUploads] = useState<SellerUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<BulkUploadPreview | null>(null);
  const [confirmResult, setConfirmResult] = useState<{ created_count: number; failed_count: number } | null>(null);

  function load() {
    listSellerUploads(token).then(setUploads).catch(() => {});
  }

  useEffect(() => { load(); }, [token]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setNotice('');
    setConfirmResult(null);
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    if (!isCsv) {
      // Excel/Word - no structured validate/preview pipeline yet, just stored for the AI platform to parse later.
      setBusy(true);
      try {
        await uploadSellerFile(file, token);
        setNotice(`Uploaded ${file.name}. The AI platform will parse it into draft orders.`);
        load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Upload failed.');
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const result = await previewBulkUpload(file, token);
      setPreview(result);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not validate this file.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const validRows: BulkUploadRow[] = preview.rows.filter((r) => r.errors.length === 0).map((r) => ({
        receiver_name: r.data.receiver_name,
        receiver_phone: r.data.receiver_phone,
        receiver_address: r.data.receiver_address,
        receiver_city: r.data.receiver_city,
        weight_kg: Number(r.data.weight_kg),
        cod_amount: Number(r.data.cod_amount),
      }));
      const result = await confirmBulkUpload(preview.upload_id, validRows, token);
      setConfirmResult(result);
      setPreview(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm this upload.');
    } finally {
      setBusy(false);
    }
  }

  if (preview) {
    return (
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-ink">Preview — {preview.valid_count} valid, {preview.error_count} with errors</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Rows with errors are skipped when you confirm - fix and re-upload if you need them booked too.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPreview(null)} className="text-sm font-semibold px-4 py-2 rounded-[10px] text-muted-foreground hover:text-ink transition-colors">Cancel</button>
            <button onClick={handleConfirm} disabled={busy || preview.valid_count === 0} className="text-sm font-bold px-5 py-2.5 rounded-[10px] bg-navy text-white hover:bg-navy-light disabled:opacity-50 transition-colors">
              {busy ? 'Booking…' : `Confirm & book ${preview.valid_count}`}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-danger mb-3">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted-foreground uppercase">
                <th className="py-2 pr-3 font-semibold">Row</th>
                <th className="py-2 pr-3 font-semibold">Receiver</th>
                <th className="py-2 pr-3 font-semibold">Phone</th>
                <th className="py-2 pr-3 font-semibold">City</th>
                <th className="py-2 pr-3 font-semibold">Weight</th>
                <th className="py-2 pr-3 font-semibold">COD</th>
                <th className="py-2 font-semibold">Errors</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.row_number} className={`border-b border-line last:border-0 ${r.errors.length ? 'bg-[#FBEAE7]/40' : ''}`}>
                  <td className="py-2 pr-3 text-muted-foreground">{r.row_number}</td>
                  <td className="py-2 pr-3 text-ink">{r.data.receiver_name}</td>
                  <td className="py-2 pr-3 text-ink">{r.data.receiver_phone}</td>
                  <td className="py-2 pr-3 text-ink">{r.data.receiver_city}</td>
                  <td className="py-2 pr-3 text-ink">{r.data.weight_kg}</td>
                  <td className="py-2 pr-3 text-ink">{r.data.cod_amount}</td>
                  <td className="py-2 text-danger text-xs">{r.errors.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-ink">Upload bulk orders</h3>
          <a href={bulkUploadTemplateUrl()} className="text-xs font-bold text-orange hover:underline">Download CSV template</a>
        </div>
        <p className="text-xs text-muted-foreground mb-4">A .csv built from the template is validated instantly - you&apos;ll preview every row before anything is booked. Excel/Word files are stored for Raftaar&apos;s AI platform to parse later.</p>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-[14px] px-6 py-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-orange bg-[#FBF3EA]' : 'border-line hover:border-orange'}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="text-sm font-semibold text-ink">{busy ? 'Processing…' : 'Drag & drop, or click to choose a file'}</span>
          <span className="text-xs text-muted-foreground">.csv · .xlsx · .xls · .doc · .docx (max 25MB)</span>
          <input
            type="file"
            disabled={busy}
            accept=".csv,.xlsx,.xls,.doc,.docx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
        {error && <p className="text-sm text-danger mt-3">{error}</p>}
        {notice && <p className="text-sm text-success mt-3">{notice}</p>}
        {confirmResult && (
          <p className="text-sm text-success mt-3">
            Booked {confirmResult.created_count} order{confirmResult.created_count === 1 ? '' : 's'}
            {confirmResult.failed_count > 0 ? ` · ${confirmResult.failed_count} skipped` : ''}. See the Parcels tab.
          </p>
        )}
      </div>

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <h3 className="font-bold text-ink">Your uploads</h3>
        </div>
        {uploads.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">No files uploaded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3.5 font-semibold text-ink">{u.original_filename}</td>
                  <td className="px-6 py-3.5 uppercase text-muted-foreground text-xs">{u.file_type || '—'}</td>
                  <td className="px-6 py-3.5 text-muted-foreground text-xs capitalize">{u.status}{u.row_count != null ? ` · ${u.row_count} rows` : ''}</td>
                  <td className="px-6 py-3.5 text-muted-foreground text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RnpTab({ token }: { token: string }) {
  const [partners, setPartners] = useState<RNP[]>([]);
  const [form, setForm] = useState({ shop_name: '', owner_name: '', phone: '', city: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() {
    listSellerRNP(token).then(setPartners).catch(() => {});
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await registerRNP(form, token);
      setNotice('RNP partner registered — awaiting admin approval.');
      setForm({ shop_name: '', owner_name: '', phone: '', city: '', address: '' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register RNP.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-card shadow-card p-6">
        <h3 className="font-bold text-ink mb-1">Register an RNP point</h3>
        <p className="text-xs text-muted-foreground mb-4">Raftaar Neighbourhood Points — local shops as your drop-off / pick-up nodes.</p>
        <form onSubmit={handleRegister} className="space-y-3">
          <input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} required placeholder="Shop name" className="w-full text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE]" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Owner name" className="text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE]" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="Phone" className="text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE]" />
          </div>
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="w-full text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE]" />
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="w-full text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE]" />
          {error && <p className="text-sm text-danger">{error}</p>}
          {notice && <p className="text-sm text-success">{notice}</p>}
          <button disabled={submitting} className="w-full text-sm font-bold px-5 py-3 rounded-[10px] bg-navy text-white hover:bg-navy-light disabled:opacity-50 transition-colors">
            {submitting ? 'Registering…' : 'Register RNP'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <h3 className="font-bold text-ink">Your RNP points</h3>
        </div>
        {partners.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">No RNP points registered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3.5 font-semibold text-ink">{p.shop_name}</td>
                  <td className="px-6 py-3.5 text-muted-foreground">{p.city || '—'}</td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      p.status === 'approved' ? 'bg-[#EAF7EF] text-success' : p.status === 'suspended' ? 'bg-[#FBEAE7] text-danger' : 'bg-[#FBF3EA] text-orange'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================== MARKETPLACE ==============================

const mpInputCls = 'text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE] outline-none focus:border-orange transition-colors';

function MarketplaceTab({ token }: { token: string }) {
  const [section, setSection] = useState<'products' | 'orders' | 'ratings'>('products');
  const pills: { key: typeof section; label: string }[] = [
    { key: 'products', label: 'My Products' },
    { key: 'orders', label: 'Marketplace Orders' },
    { key: 'ratings', label: 'Ratings' },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        {pills.map((p) => (
          <button
            key={p.key}
            onClick={() => setSection(p.key)}
            className={`text-sm font-semibold px-4 py-2 rounded-[10px] transition-colors ${
              section === p.key ? 'bg-navy text-white' : 'bg-white text-muted-foreground border border-line hover:text-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {section === 'products' && <ProductsSection token={token} />}
      {section === 'orders' && <MarketplaceOrdersSection token={token} />}
      {section === 'ratings' && <SellerRatingsSection token={token} />}
    </div>
  );
}

function ProductsSection({ token }: { token: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '', stock_quantity: '', unit_weight_kg: '1', image_url: '' });
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  function load() {
    setLoading(true);
    listSellerProducts(token).then(setProducts).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [token]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createSellerProduct({
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity) || 0,
        unit_weight_kg: Number(form.unit_weight_kg) || 1,
        image_url: form.image_url || null,
        is_active: true,
      }, token);
      setForm({ name: '', description: '', category: '', price: '', stock_quantity: '', unit_weight_kg: '1', image_url: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create product.');
    }
  }

  async function toggleActive(p: Product) {
    setBusyId(p.id);
    try {
      await updateSellerProduct(p.id, { is_active: !p.is_active }, token);
      load();
    } catch { /* surfaced via row staying unchanged */ } finally {
      setBusyId('');
    }
  }

  async function adjustStock(p: Product, delta: number) {
    const next = Math.max(0, p.stock_quantity + delta);
    setBusyId(p.id);
    try {
      await updateSellerProduct(p.id, { stock_quantity: next }, token);
      load();
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="self-start text-sm font-bold px-4 py-2.5 rounded-[10px] bg-orange text-white hover:bg-orange-light transition-colors">
          + List a product
        </button>
      ) : (
        <div className="bg-white rounded-card shadow-card p-6">
          <h3 className="font-bold text-ink mb-4">List a new product</h3>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2 flex items-start gap-4">
              <ProductImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} token={token} />
              <p className="text-xs text-muted-foreground pt-1">JPEG, PNG or WebP, up to 8MB. This is what buyers see first on the marketplace.</p>
            </div>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Product name" className={`${mpInputCls} md:col-span-2`} />
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" className={mpInputCls} />
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required type="number" min="1" step="0.01" placeholder="Price (PKR)" className={mpInputCls} />
            <input value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} type="number" min="0" placeholder="Stock quantity" className={mpInputCls} />
            <input value={form.unit_weight_kg} onChange={(e) => setForm({ ...form, unit_weight_kg: e.target.value })} type="number" min="0.1" step="0.1" placeholder="Weight per unit (kg)" className={mpInputCls} />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3} className={`${mpInputCls} md:col-span-2`} />
            {error && <p className="text-sm text-danger md:col-span-2">{error}</p>}
            <div className="flex gap-3 md:col-span-2">
              <button type="submit" className="text-sm font-bold px-5 py-2.5 rounded-[10px] bg-navy text-white hover:bg-navy-light transition-colors">List product</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-semibold px-5 py-2.5 rounded-[10px] text-muted-foreground hover:text-ink transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : products.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No products listed yet — customers can't find you on the marketplace until you list one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted-foreground uppercase">
                <th className="px-6 py-3 font-semibold"></th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="pl-6 py-3">
                    <ProductThumbnailCell product={p} token={token} onUpdated={load} />
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-ink">{p.name}{p.category && <span className="block text-xs font-normal text-muted-foreground">{p.category}</span>}</td>
                  <td className="px-4 py-3.5 text-ink">Rs {p.price.toLocaleString()}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button disabled={busyId === p.id} onClick={() => adjustStock(p, -1)} className="w-6 h-6 rounded-md border border-line hover:bg-page text-xs">−</button>
                      <span className="w-8 text-center">{p.stock_quantity}</span>
                      <button disabled={busyId === p.id} onClick={() => adjustStock(p, 1)} className="w-6 h-6 rounded-md border border-line hover:bg-page text-xs">+</button>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.is_active ? 'bg-[#EAF7EF] text-success' : 'bg-[#FBEAE7] text-danger'}`}>
                      {p.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button disabled={busyId === p.id} onClick={() => toggleActive(p)} className="text-xs font-bold text-navy hover:underline disabled:opacity-50">
                      {p.is_active ? 'Hide' : 'Publish'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ProductThumbnailCell({ product, token, onUpdated }: { product: Product; token: string; onUpdated: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadSellerProductImage(file, token);
      await updateSellerProduct(product.id, { image_url: url }, token);
      onUpdated();
    } catch { /* keep the existing thumbnail on failure */ } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-line flex-none group bg-page">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImagePlus className="w-4 h-4" /></div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Change photo"
        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <ImagePlus className="w-3.5 h-3.5 text-white" />}
      </button>
    </div>
  );
}

function MarketplaceOrdersSection({ token }: { token: string }) {
  const [orders, setOrders] = useState<SellerMarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listSellerMarketplaceOrders(token).then(setOrders).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (orders.length === 0) return <div className="bg-white rounded-card shadow-card p-6 text-sm text-muted-foreground">No marketplace orders yet.</div>;

  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => (
        <div key={o.id} className="bg-white rounded-card shadow-card overflow-hidden">
          <div className="w-full flex items-center justify-between px-6 py-4">
            <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="flex-1 text-left min-w-0">
              <p className="font-semibold text-ink text-sm">{o.quantity} × {o.product_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{o.buyer_name} · {o.buyer_phone} · {o.dropoff_city || '—'}</p>
            </button>
            <div className="flex items-center gap-3 flex-none">
              <span className="text-sm font-bold text-navy">Rs {o.final_price.toLocaleString()}</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FBF3EA] text-orange">{o.status.replace(/_/g, ' ')}</span>
              <button
                onClick={() => window.open(`/seller/print/order/${o.id}`, '_blank')}
                title="Print packing slip"
                className="p-2 rounded-lg border border-line text-muted-foreground hover:text-navy hover:border-navy transition-colors"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
          {expanded === o.id && (
            <div className="border-t border-line px-6 py-5 flex flex-col items-center gap-3">
              <p className="text-xs text-muted-foreground self-start">Attach this to the parcel for hub/rider pickup scanning.</p>
              <Barcode value={o.tracking_number} />
              <p className="font-mono text-xs text-muted-foreground">{o.tracking_number}</p>
              <button
                onClick={() => window.open(`/seller/print/order/${o.id}`, '_blank')}
                className="text-sm font-bold px-4 py-2 rounded-[10px] bg-navy text-white hover:bg-navy-light transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print packing slip
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SellerRatingsSection({ token }: { token: string }) {
  const [summary, setSummary] = useState<RatingSummary | null>(null);

  useEffect(() => {
    getSellerRatings(token).then(setSummary).catch(() => {});
  }, [token]);

  if (!summary) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <StarDisplay value={summary.average} size={20} />
        <span className="text-xs text-muted-foreground">({summary.count} review{summary.count === 1 ? '' : 's'})</span>
      </div>
      {summary.ratings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {summary.ratings.map((r) => (
            <div key={r.id} className="border-b border-line last:border-0 pb-4 last:pb-0">
              <StarDisplay value={r.score} size={14} />
              {r.comment && <p className="text-sm text-ink mt-1">{r.comment}</p>}
              <p className="text-xs text-muted-foreground mt-1">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================== BOOK SHIPMENT ==============================

function BookShipmentTab({ token }: { token: string }) {
  const [form, setForm] = useState({ receiver_name: '', receiver_phone: '', receiver_address: '', receiver_city: '', weight_kg: '1', cod_amount: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<Order | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const order = await bookSellerOrder({
        receiver_name: form.receiver_name,
        receiver_phone: form.receiver_phone,
        receiver_address: form.receiver_address,
        receiver_city: form.receiver_city,
        weight_kg: Number(form.weight_kg),
        cod_amount: Number(form.cod_amount),
      }, token);
      setBooked(order);
      setForm({ receiver_name: '', receiver_phone: '', receiver_address: '', receiver_city: '', weight_kg: '1', cod_amount: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not book this shipment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-card shadow-card p-6">
        <h3 className="font-bold text-ink mb-1">Receiver details</h3>
        <p className="text-xs text-muted-foreground mb-4">Rider collects from your pickup address on file and delivers to the receiver below.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} required placeholder="Receiver name" className={`${mpInputCls} w-full`} />
          <input value={form.receiver_phone} onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })} required placeholder="Receiver phone (03xxxxxxxxx)" className={`${mpInputCls} w-full`} />
          <input value={form.receiver_address} onChange={(e) => setForm({ ...form, receiver_address: e.target.value })} required minLength={5} placeholder="Receiver address" className={`${mpInputCls} w-full`} />
          <div className="grid grid-cols-3 gap-3">
            <input value={form.receiver_city} onChange={(e) => setForm({ ...form, receiver_city: e.target.value })} required placeholder="City" className={mpInputCls} />
            <input value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} required type="number" min="0.1" step="0.1" placeholder="Weight (kg)" className={mpInputCls} />
            <input value={form.cod_amount} onChange={(e) => setForm({ ...form, cod_amount: e.target.value })} required type="number" min="0" step="1" placeholder="COD amount (Rs)" className={mpInputCls} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button disabled={submitting} className="w-full text-sm font-bold px-5 py-3 rounded-[10px] bg-orange text-white hover:bg-orange-light disabled:opacity-50 transition-colors">
            {submitting ? 'Booking…' : 'Book shipment'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-card shadow-card p-6 flex flex-col items-center justify-center text-center">
        {booked ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-success mb-3">AWB generated</p>
            <Barcode value={booked.tracking_number} />
            <p className="font-mono font-bold text-ink mt-2">{booked.tracking_number}</p>
            <p className="text-sm text-muted-foreground mt-3">Rs {(booked.final_price ?? 0).toLocaleString()} total · COD Rs {(booked.unit_price ?? 0).toLocaleString()}</p>
          </>
        ) : (
          <>
            <PackagePlus className="w-10 h-10 text-line mb-3" />
            <p className="text-sm text-muted-foreground">Your AWB and barcode will appear here the moment you book.</p>
          </>
        )}
      </div>
    </div>
  );
}

// ============================== PARCELS ==============================

const PARCEL_STATUSES = ['created', 'assigned', 'picked_up', 'in_hub', 'in_transit', 'dest_hub', 'out_for_delivery', 'delivered', 'failed', 'rto', 'cancelled'];

function ParcelsTab({ token }: { token: string }) {
  const [parcels, setParcels] = useState<SellerParcelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      listSellerParcels(token, { status: status || undefined, q: q || undefined })
        .then(setParcels)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [token, status, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tracking #, receiver name or phone…" className={`${mpInputCls} flex-1`} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={mpInputCls}>
          <option value="">All statuses</option>
          {PARCEL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : parcels.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No parcels match this filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted-foreground uppercase">
                <th className="px-6 py-3 font-semibold">Tracking</th>
                <th className="px-4 py-3 font-semibold">Receiver</th>
                <th className="px-4 py-3 font-semibold">City</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">COD</th>
                <th className="px-6 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {parcels.map((p) => (
                <tr key={p.id} onClick={() => setSelected(p.tracking_number)} className="border-b border-line last:border-0 cursor-pointer hover:bg-page transition-colors">
                  <td className="px-6 py-3.5 font-mono text-xs text-ink">{p.tracking_number}</td>
                  <td className="px-4 py-3.5 text-ink">{p.receiver_name || '—'}<span className="block text-xs text-muted-foreground">{p.receiver_phone}</span></td>
                  <td className="px-4 py-3.5 text-muted-foreground">{p.dropoff_city || '—'}</td>
                  <td className="px-4 py-3.5 text-muted-foreground capitalize">{p.source}</td>
                  <td className="px-4 py-3.5 text-ink">{p.cod_amount != null ? `Rs ${p.cod_amount.toLocaleString()}` : '—'}</td>
                  <td className="px-6 py-3.5">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FBF3EA] text-orange capitalize">{p.status.replace(/_/g, ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && <ParcelDetailDialog trackingNumber={selected} token={token} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ParcelDetailDialog({ trackingNumber, token, onClose }: { trackingNumber: string; token: string; onClose: () => void }) {
  const [detail, setDetail] = useState<SellerParcelDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getSellerParcelDetail(trackingNumber, token).then(setDetail).catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this parcel.'));
  }, [trackingNumber, token]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-card shadow-card max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-ink font-mono">{trackingNumber}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Receiver</p><p className="text-ink font-semibold">{detail.receiver_name}</p><p className="text-xs text-muted-foreground">{detail.receiver_phone}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><p className="text-ink font-semibold capitalize">{detail.status.replace(/_/g, ' ')}</p></div>
              <div className="col-span-2"><p className="text-xs text-muted-foreground">Deliver to</p><p className="text-ink">{detail.dropoff_full_address}</p></div>
              <div><p className="text-xs text-muted-foreground">COD amount</p><p className="text-ink font-semibold">{detail.cod_amount != null ? `Rs ${detail.cod_amount.toLocaleString()}` : '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Weight</p><p className="text-ink">{detail.package_weight_kg ?? '—'} kg</p></div>
            </div>

            {detail.last_lat != null && detail.last_lng != null && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Last scan location</p>
                <iframe
                  className="w-full h-48 rounded-[10px] border border-line"
                  loading="lazy"
                  src={`https://maps.google.com/maps?q=${detail.last_lat},${detail.last_lng}&z=14&output=embed`}
                />
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Timeline</p>
              {detail.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scans recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {detail.timeline.slice().reverse().map((e, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-orange mt-1.5 flex-none" />
                      <div>
                        <p className="text-sm font-semibold text-ink capitalize">{e.status.replace(/_/g, ' ')}</p>
                        {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                        <p className="text-xs text-muted-foreground">{e.created_at ? new Date(e.created_at).toLocaleString() : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================== RETURNS / RTO ==============================

function ReturnsTab({ token }: { token: string }) {
  const [rows, setRows] = useState<SellerReturnRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSellerReturns(token).then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0) return <div className="bg-white rounded-card shadow-card p-6 text-sm text-muted-foreground">No parcels awaiting return right now.</div>;

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted-foreground uppercase">
            <th className="px-6 py-3 font-semibold">Tracking</th>
            <th className="px-4 py-3 font-semibold">Receiver</th>
            <th className="px-4 py-3 font-semibold">COD</th>
            <th className="px-4 py-3 font-semibold">Batch</th>
            <th className="px-6 py-3 font-semibold text-right">SLA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              <td className="px-6 py-3.5 font-mono text-xs text-ink">{r.tracking_number}</td>
              <td className="px-4 py-3.5 text-ink">{r.receiver_name || '—'}<span className="block text-xs text-muted-foreground">{r.dropoff_city}</span></td>
              <td className="px-4 py-3.5 text-ink">{r.cod_amount != null ? `Rs ${r.cod_amount.toLocaleString()}` : '—'}</td>
              <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{r.batch_id || 'Not yet batched'}</td>
              <td className="px-6 py-3.5 text-right">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${r.sla_breached ? 'bg-[#FBEAE7] text-danger' : r.sla_hours_left < 12 ? 'bg-[#FBF0DC] text-[#B9770E]' : 'bg-[#EAF7EF] text-success'}`}>
                  {r.sla_breached ? 'SLA breached' : `${r.sla_hours_left}h left`}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}