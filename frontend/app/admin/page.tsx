'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { cn } from '@/lib/utils';
import {
  listAllOrders,
  listRiders,
  assignRider,
  listStaffAndRiders,
  createStaffOrRider,
  getAdminAnalytics,
  Order,
  AdminRider,
  AdminUser,
  AdminAnalytics,
  ApiError,
  listBranches,
  Branch,
  Zone,
  listZones,
  StaffProfile,
  deleteUserbyAdmin,
} from '@/lib/api';
import {
  CodSettlementsTab,
  BusNetworkTab,
  WalletsTab,
  RnpTab,
  DiscountsTab,
} from './components';
import { ChartCard } from '@/components/charts/ChartCard';
import { TrendLine } from '@/components/charts/TrendLine';
import { ComparisonBars } from '@/components/charts/ComparisonBars';
import { StatusDonut } from '@/components/charts/StatusDonut';
import { STATUS as STATUS_COLORS } from '@/components/charts/palette';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Activity, AlertTriangle, BarChart3, Bell, Building2, Bus, ChevronDown, ChevronRight,
  CircleDollarSign, Landmark, LayoutDashboard, LogOut, MapPin, Menu, Package, Percent,
  Search, Settings, Shield, Tags, TrendingDown, TrendingUp, Truck, Users, Wallet, X,
} from 'lucide-react';

type View =
  | 'overview' | 'orders' | 'analytics'
  | 'team' | 'settlements' | 'wallets'
  | 'bus' | 'rnp' | 'discounts' | 'settings';

const NAV_SECTIONS: { label: string; items: { view: View; label: string; icon: React.ReactNode }[] }[] = [
  { label: 'Command', items: [
    { view: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { view: 'orders', label: 'All Orders', icon: <Package className="h-4 w-4" /> },
    { view: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
  ]},
  { label: 'Network', items: [
    { view: 'bus', label: 'Bus Network', icon: <Bus className="h-4 w-4" /> },
    { view: 'rnp', label: 'RNP Points', icon: <MapPin className="h-4 w-4" /> },
    { view: 'team', label: 'Team & Riders', icon: <Users className="h-4 w-4" /> },
  ]},
  { label: 'Financials', items: [
    { view: 'settlements', label: 'COD Settlements', icon: <CircleDollarSign className="h-4 w-4" /> },
    { view: 'wallets', label: 'Seller Wallets', icon: <Wallet className="h-4 w-4" /> },
    { view: 'discounts', label: 'Discounts', icon: <Tags className="h-4 w-4" /> },
  ]},
  { label: 'System', items: [
    { view: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ]},
];

const PAGE_META: Record<View, { title: string; sub: string }> = {
  overview: { title: 'Command Center', sub: 'Network-wide performance, live in one place' },
  orders: { title: 'All Orders', sub: 'Every order across every branch and channel' },
  analytics: { title: 'Analytics & Insights', sub: 'Revenue, status and channel performance' },
  team: { title: 'Team & Riders', sub: 'Staff, rider and admin accounts' },
  settlements: { title: 'COD Settlements', sub: 'Guaranteed next-morning (T+1) payouts' },
  wallets: { title: 'Seller Wallets', sub: 'Business wallets, locks and reconciliation' },
  bus: { title: 'Bus Network (Layer 1)', sub: 'Operators, schedules and manifest tracking' },
  rnp: { title: 'RNP Network (Layer 3)', sub: 'Neighbourhood drop & pick-up points' },
  discounts: { title: 'Discount Engine', sub: 'Signup offers and promo codes' },
  settings: { title: 'Settings', sub: 'System configuration' },
};

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
  delivered: 'success',
  payment_received: 'success',
  paid: 'success',
  approved: 'success',
  active: 'success',
  in_transit: 'warning',
  assigned: 'warning',
  picked_up: 'warning',
  created: 'info',
  pending: 'warning',
  failed: 'danger',
  cancelled: 'secondary',
  returned: 'secondary',
  suspended: 'danger',
};

function titleStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <AdminContent />
    </RoleGuard>
  );
}

function AdminContent() {
  const { token, setToken } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<View>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<AdminRider[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [syncing, setSyncing] = useState(true);

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  useEffect(() => {
    if (!token) return;
    setSyncing(true);
    Promise.all([listAllOrders(token), listRiders(token), getAdminAnalytics(token)])
      .then(([o, r, a]) => { setOrders(o); setRiders(r); setAnalytics(a); })
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, [token]);

  const stats = useMemo(() => {
    const created = orders.filter((o) => o.status === 'created').length;
    const assigned = orders.filter((o) => o.status === 'assigned').length;
    const delivered = analytics?.status_counts?.delivered ?? 0;
    const inTransit = analytics?.status_counts?.in_transit ?? 0;
    const totalRevenue = analytics?.total_revenue ?? 0;
    const available = riders.filter((r) => r.is_available).length;
    return { created, assigned, delivered, inTransit, totalRevenue, available, totalRiders: riders.length };
  }, [orders, riders, analytics]);

  function switchView(v: View) {
    setView(v);
    setSidebarOpen(false);
    setOrderSearch('');
  }

  const alerts = useMemo(() => {
    const list: { id: string; icon: React.ReactNode; tone: string; text: string }[] = [];
    if (stats.created > 0) list.push({ id: 'unassigned', icon: <Package className="h-3.5 w-3.5" />, tone: 'text-orange bg-[#FBF3EA]', text: `${stats.created} order(s) awaiting assignment` });
    if (stats.available === 0 && riders.length > 0) list.push({ id: 'riders', icon: <Users className="h-3.5 w-3.5" />, tone: 'text-danger bg-[#FBE9E5]', text: 'No riders currently available' });
    return list;
  }, [stats, riders]);

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
                Admin Command Center
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
                        {item.view === 'orders' && stats.created > 0 && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[0.65rem] font-bold text-primary">
                            {stats.created}
                          </span>
                        )}
                        {active && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <div className="px-3 pb-1.5 text-[0.68rem] font-bold uppercase tracking-wider text-white/40">
                Governance
              </div>
              <div className="flex flex-col gap-0.5">
                {[
                  { href: '/admin/dashboard', label: 'Network Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
                  { href: '/admin/users', label: 'Users & Sellers', icon: <Users className="h-4 w-4" /> },
                  { href: '/admin/corridors', label: 'Corridors', icon: <MapPin className="h-4 w-4" /> },
                  { href: '/admin/pricing', label: 'Pricing', icon: <Percent className="h-4 w-4" /> },
                  { href: '/admin/audit-log', label: 'Audit Log', icon: <Shield className="h-4 w-4" /> },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <span className="text-white/50 group-hover:text-white/80">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </nav>
        </ScrollArea>

        {/* ============ SIDEBAR ANALYTICS ============ */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-3.5">
            <div className="flex items-center gap-2 pb-3">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wide text-white/70">Network Pulse</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg bg-white/5 px-2.5 py-2">
                <div className="text-[0.65rem] font-medium uppercase tracking-wide text-white/40">Total orders</div>
                <div className="mt-0.5 text-lg font-bold leading-none">{syncing ? <Skeleton className="h-5 w-10 bg-white/10" /> : stats.created + stats.assigned + stats.delivered + stats.inTransit + orders.length}</div>
              </div>
              <div className="rounded-lg bg-white/5 px-2.5 py-2">
                <div className="text-[0.65rem] font-medium uppercase tracking-wide text-white/40">Delivered</div>
                <div className="mt-0.5 text-lg font-bold leading-none text-success">{syncing ? <Skeleton className="h-5 w-10 bg-white/10" /> : stats.delivered}</div>
              </div>
              <div className="rounded-lg bg-white/5 px-2.5 py-2">
                <div className="text-[0.65rem] font-medium uppercase tracking-wide text-white/40">In transit</div>
                <div className="mt-0.5 text-lg font-bold leading-none text-primary">{syncing ? <Skeleton className="h-5 w-10 bg-white/10" /> : stats.inTransit}</div>
              </div>
              <div className="rounded-lg bg-white/5 px-2.5 py-2">
                <div className="text-[0.65rem] font-medium uppercase tracking-wide text-white/40">Riders online</div>
                <div className="mt-0.5 text-lg font-bold leading-none">{syncing ? <Skeleton className="h-5 w-10 bg-white/10" /> : `${stats.available}/${stats.totalRiders}`}</div>
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
              <AvatarFallback className="bg-primary text-xs font-bold text-white">OP</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">Operations Admin</div>
              <div className="truncate text-[0.7rem] text-white/50">admin@raftaarexpress.com</div>
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
        {/* HEADER */}
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

          {view === 'orders' && (
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search tracking #, city…"
                className="w-64 bg-card pl-9"
              />
            </div>
          )}

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
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">All clear — no pending alerts.</div>
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
                  <AvatarFallback className="bg-navy text-xs font-bold text-white">OA</AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Operations Admin</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => switchView('settings')}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="p-5 md:p-8">
          {view === 'overview' && (
            <OverviewView stats={stats} analytics={analytics} orders={orders} riders={riders} syncing={syncing} onNavigate={switchView} />
          )}
          {view === 'orders' && (
            <OrdersTab token={token!} search={orderSearch} />
          )}
          {view === 'analytics' && <AnalyticsTab token={token!} />}
          {view === 'team' && <TeamTab token={token!} />}
          {view === 'settlements' && <CodSettlementsTab token={token!} />}
          {view === 'wallets' && <WalletsTab token={token!} />}
          {view === 'bus' && <BusNetworkTab token={token!} />}
          {view === 'rnp' && <RnpTab token={token!} />}
          {view === 'discounts' && <DiscountsTab token={token!} />}
          {view === 'settings' && <SettingsTab token={token!} />}
        </main>
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW — Command Center
// ============================================================
function OverviewView({ stats, analytics, orders, riders, syncing, onNavigate }: {
  stats: { created: number; assigned: number; delivered: number; inTransit: number; totalRevenue: number; available: number; totalRiders: number };
  analytics: AdminAnalytics | null;
  orders: Order[];
  riders: AdminRider[];
  syncing: boolean;
  onNavigate: (v: View) => void;
}) {
  const kpis = [
    { label: 'Total orders', value: stats.created + stats.assigned + stats.delivered + stats.inTransit + orders.length, icon: <Package className="h-5 w-5" />, tone: 'bg-[#EAF1FC] text-navy', trend: `${stats.created} awaiting assignment`, up: stats.created === 0 },
    { label: 'Revenue (delivered)', value: `Rs ${stats.totalRevenue.toLocaleString()}`, icon: <CircleDollarSign className="h-5 w-5" />, tone: 'bg-[#EAF7EF] text-success', trend: 'T+1 settlements next morning', up: true },
    { label: 'Delivered', value: stats.delivered, icon: <Shield className="h-5 w-5" />, tone: 'bg-[#FBF3EA] text-orange', trend: '0% RTO in live deliveries', up: true },
    { label: 'In transit', value: stats.inTransit, icon: <Truck className="h-5 w-5" />, tone: 'bg-[#FBE9E5] text-danger', trend: '30–45 min bus dispatches', up: stats.inTransit > 0 },
    { label: 'Riders available', value: `${stats.available}/${stats.totalRiders}`, icon: <Users className="h-5 w-5" />, tone: 'bg-[#EAF1FC] text-navy', trend: stats.available > 0 ? 'Ready for dispatch' : 'None online', up: stats.available > 0 },
    { label: 'COD pending', value: analytics ? stats.inTransit + stats.assigned + stats.created : 0, icon: <Wallet className="h-5 w-5" />, tone: 'bg-[#FBF0DC] text-[#B9770E]', trend: 'Settle T+1 from Financials', up: true },
  ];

  const week = analytics?.daily_last_7_days ?? [];
  const maxRevenue = Math.max(1, ...week.map((d) => d.revenue));
  const totalWeeklyRevenue = week.reduce((s, d) => s + d.revenue, 0);
  const statusEntries = Object.entries(analytics?.status_counts ?? {});
  const maxStatus = Math.max(1, ...statusEntries.map(([, c]) => c));

  if (syncing) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* KPI ROW */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', k.tone)}>{k.icon}</span>
                {k.up ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-danger" />
                )}
              </div>
              <div className="mt-3 text-xl font-bold tracking-tight text-ink">{k.value}</div>
              <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{k.label}</div>
              <div className="mt-1.5 text-[0.68rem] font-medium text-muted-foreground/80">{k.trend}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CHARTS */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Revenue — last 7 days</CardTitle>
              <CardDescription>Delivered orders, network-wide</CardDescription>
            </div>
            <Badge variant="success" className="font-mono">Rs {totalWeeklyRevenue.toLocaleString()}</Badge>
          </CardHeader>
          <CardContent>
            {week.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No delivered orders in the last 7 days yet.</p>
            ) : (
              <div className="flex h-44 items-end gap-3">
                {week.map((d) => (
                  <div key={d.date} className="group flex flex-1 flex-col items-center gap-1.5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-primary/80 to-primary transition-all group-hover:from-primary group-hover:to-primary-light"
                            style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          Rs {d.revenue.toLocaleString()} · {d.orders} orders
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="text-[0.65rem] text-muted-foreground">
                      {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Orders by status</CardTitle>
            <CardDescription>Live pipeline snapshot</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {statusEntries.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
            {statusEntries.map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground capitalize">{status.replace('_', ' ')}</span>
                <Progress value={(count / maxStatus) * 100} className="h-2 flex-1" />
                <span className="w-6 text-right text-xs font-semibold text-ink">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* RECENT ORDERS + TOP RIDERS */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Recent orders</CardTitle>
              <CardDescription>Latest shipments across the network</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('orders')}>View all</Button>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(0, 6).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs text-ink">{o.tracking_number}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.pickup_address?.city || '—'} → {o.dropoff_address?.city || '—'}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{o.booking_channel || 'app'}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE_VARIANT[o.status] || 'secondary'} className="capitalize">
                          {o.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{o.final_price ?? o.estimated_price ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Top riders</CardTitle>
            <CardDescription>By delivered orders</CardDescription>
          </CardHeader>
          <CardContent>
            {!analytics || analytics.top_riders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No delivery data yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {analytics.top_riders.slice(0, 5).map((r, i) => (
                  <div key={r.full_name + i} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-navy">
                      {i + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-navy text-[0.65rem] font-bold text-white">
                        {r.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{r.full_name}</div>
                      <div className="text-[0.7rem] text-muted-foreground">{r.deliveries} deliveries</div>
                    </div>
                    <span className="font-semibold text-success">Rs {r.earnings.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// ORDERS
// ============================================================
function OrdersTab({ token, search }: { token: string; search: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<AdminRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listAllOrders(token), listRiders(token)])
      .then(([o, r]) => { setOrders(o); setRiders(r); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load data.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAssign(orderId: string, riderId: string) {
    if (!riderId) return;
    setAssigningId(orderId);
    setError('');
    try {
      await assignRider(orderId, riderId, token);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'assigned' } : o)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign rider.');
    } finally {
      setAssigningId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (q) {
        const hay = [o.tracking_number, o.pickup_address?.contact_name, o.dropoff_address?.contact_name, o.pickup_address?.city, o.dropoff_address?.city]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const statuses = ['created', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled', 'returned'];

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-ink">{orders.length}</div><div className="text-xs font-semibold text-muted-foreground">Total orders</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-ink">{orders.filter((o) => o.status === 'created').length}</div><div className="text-xs font-semibold text-muted-foreground">Awaiting rider</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-success">{orders.filter((o) => o.status === 'delivered').length}</div><div className="text-xs font-semibold text-muted-foreground">Delivered</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-danger">{orders.filter((o) => o.status === 'failed' || o.status === 'cancelled').length}</div><div className="text-xs font-semibold text-muted-foreground">Failed / cancelled</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>All orders</CardTitle>
            <CardDescription>{filtered.length} shown</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input value={search} readOnly placeholder="Search…" className="hidden w-56 md:flex" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Any status</option>
              {statuses.map((s) => <option key={s} value={s}>{titleStatus(s)}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No orders match this filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Assign rider</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs text-ink">{order.tracking_number}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[order.status] || 'secondary'} className="capitalize">
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize text-muted-foreground">{order.booking_channel}</TableCell>
                    <TableCell>
                      {order.status === 'created' ? (
                        <select
                          disabled={assigningId === order.id}
                          onChange={(e) => handleAssign(order.id, e.target.value)}
                          defaultValue=""
                          className="h-8 rounded-md border border-input bg-card px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                        >
                          <option value="" disabled>{assigningId === order.id ? 'Assigning…' : 'Select rider'}</option>
                          {riders.map((r) => (
                            <option key={r.rider_id} value={r.rider_id}>{r.full_name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild><a href={`/admin/orders/${order.id}`}>View</a></Button>
                        <Button variant="ghost" size="sm" className="text-primary" asChild><a href={`/admin/orders/${order.id}/edit`}>Edit</a></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// ANALYTICS
// ============================================================
function AnalyticsTab({ token }: { token: string }) {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminAnalytics(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load analytics.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>;
  if (error) return <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>;
  if (!data) return null;

  const statusData = Object.entries(data.status_counts).map(([status, value]) => ({ label: status.replace(/_/g, ' '), value }));
  const channelData = Object.entries(data.channel_counts).map(([channel, value]) => ({ label: channel.replace(/_/g, ' '), value }));
  const money = (v: number) => `Rs ${v.toLocaleString()}`;

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total orders</div>
            <div className="mt-1 text-3xl font-bold text-ink">{data.total_orders}</div>
            <div className="mt-1 text-xs text-muted-foreground">All channels, all time</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revenue (delivered)</div>
            <div className="mt-1 text-3xl font-bold text-success">{money(data.total_revenue)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Network-wide</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">RTO rate</div>
            <div className="mt-1 text-3xl font-bold" style={{ color: data.rto_rate > 15 ? STATUS_COLORS.critical : STATUS_COLORS.good }}>
              {data.rto_rate}%
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Of resolved (delivered + RTO)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery success</div>
            <div className="mt-1 text-3xl font-bold text-ink">
              {data.total_orders ? Math.round(((data.status_counts.delivered ?? 0) / data.total_orders) * 100) : 0}%
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Delivered vs total</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">COD collected (all-time)</div>
            <div className="mt-1 text-2xl font-bold text-ink">{money(data.cod_collected_total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">COD pending payout</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: STATUS_COLORS.warning }}>{money(data.cod_pending_total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avg. delivery time</div>
            <div className="mt-1 text-2xl font-bold text-ink">{data.avg_delivery_hours != null ? `${data.avg_delivery_hours}h` : '—'}</div>
          </CardContent>
        </Card>
      </div>

      <ChartCard title="Revenue — last 7 days" description="Per-day delivered revenue" empty={data.daily_last_7_days.length === 0} emptyMessage="No delivered orders in the last 7 days yet.">
        <TrendLine data={data.daily_last_7_days} xKey="date" series={[{ key: 'revenue', label: 'Revenue' }]} valueFormatter={money} />
      </ChartCard>

      <div className="grid gap-5 md:grid-cols-2">
        <ChartCard title="Orders by status" empty={statusData.length === 0}>
          <ComparisonBars data={statusData} categoryKey="label" series={[{ key: 'value', label: 'Orders' }]} />
        </ChartCard>
        <ChartCard title="Booking channel mix" empty={channelData.length === 0}>
          <StatusDonut data={channelData} centerLabel={{ value: String(data.total_orders), caption: 'total orders' }} />
        </ChartCard>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle>Top riders</CardTitle><CardDescription>By delivered orders</CardDescription></CardHeader>
        <CardContent>
          {data.top_riders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No delivered orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Rider</TableHead>
                  <TableHead className="text-right">Deliveries</TableHead>
                  <TableHead className="text-right">Earnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_riders.map((r, i) => (
                  <TableRow key={r.full_name + i}>
                    <TableCell className="font-bold">{i + 1}</TableCell>
                    <TableCell className="font-semibold">{r.full_name}</TableCell>
                    <TableCell className="text-right">{r.deliveries}</TableCell>
                    <TableCell className="text-right font-semibold text-success">{money(r.earnings)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function SettingsTab({ token }: { token: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System settings</CardTitle>
        <CardDescription>Configuration for the Raftaar network</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-ink">Guaranteed T+1 COD settlement</div>
            <div className="text-xs text-muted-foreground">Automatic next-morning payouts for delivered COD orders</div>
          </div>
          <Badge variant="success">Enabled</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// TEAM (port of existing implementation)
// ============================================================
interface FormState {
  full_name: string;
  email: string;
  phone: string;
  cnic: string;
  password: string;
  role: 'staff' | 'rider' | 'admin' | 'customer';
  designation: string;
  zone_id: string;
  branch_id: string;
}

const INITIAL_FORM: FormState = {
  full_name: '', email: '', phone: '', cnic: '', password: '', role: 'staff' as 'staff' | 'rider' | 'admin' | 'customer', designation: '', zone_id: '', branch_id: '',
};

const USER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const MAIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" />
  </svg>
);
const PHONE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const LOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const CNIC_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10h-6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2z" /><path d="M7 21H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2z" />
    <line x1="7" y1="7" x2="7" y2="7" /><line x1="11" y1="7" x2="11" y2="7" /><line x1="7" y1="11" x2="7" y2="11" /><line x1="11" y1="11" x2="11" y2="11" />
  </svg>
);
const ICONS = {
  idCard: <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.2" /><path d="M14 10h5M14 14h5" /></>,
};
function Icon({ path, size = 18 }: { path: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}

function TeamTab({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([])
  const [showDesignationSelector, setShowDesignationSelector] = useState(true)
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showStaffZoneSelector, setShowStaffZoneSelector] = useState(true)
  const [showStaffBranchSelector, setShowStaffBranchSelector] = useState(true)
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
    loadBranches();
    loadZones();
  }, [token]);

  function loadUsers() {
    setLoading(true);
    listStaffAndRiders(token)
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load team.'))
      .finally(() => setLoading(false));
  }

  function loadBranches() {
    setLoading(true);
    listBranches(token)
      .then(setBranches)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load branches'))
      .finally(() => setLoading(false));
  }

  function filterBranches(zone_id: string) {
    setFilteredBranches(branches.filter((o) => o.zone_id == zone_id));
  }

  function loadZones() {
    setLoading(true);
    listZones(token)
      .then(setZones)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load zones.'))
      .finally(() => setLoading(false));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const newUser = await createStaffOrRider(form, token);
      setUsers((prev) => [newUser, ...prev]);
      setShowForm(false);
      setForm({ full_name: '', email: '', phone: '', cnic: '', password: '', designation: '', role: 'staff', zone_id: '', branch_id: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteUser(id: string): void {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setError('');
    deleteUserbyAdmin(id, token);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function formatCnic(raw: string): string {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 13);
    let out = digits;
    if (digits.length > 5) out = digits.slice(0, 5) + '-' + digits.slice(5);
    if (digits.length > 12) out = out.slice(0, 13) + '-' + digits.slice(12);
    return out;
  }

  function formatPhone(raw: string): string {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 11);
    let out = digits;
    if (digits.length > 4) out = digits.slice(0, 4) + '-' + digits.slice(4);
    return out;
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Customer, staff, rider and admin accounts</p>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Onboard Team Member'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New team member</CardTitle>
            <CardDescription>Create a staff or rider account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-x-6 md:grid-cols-2">
              <Field id="full_name" label="Full Name" placeholder="Enter your full name" icon={USER_ICON} required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              <Field id="email" type="email" label="Email" icon={MAIL_ICON} placeholder="Enter email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <Field id="phone" label="Phone Number" icon={PHONE_ICON} placeholder="e.g. 03001234567" required value={form.phone} onChange={(e) => set('phone', formatPhone(e.target.value))} />
              <Field id="cnic" label="CNIC Number" icon={<Icon path={ICONS.idCard} />} placeholder="#####-#######-#" maxLength={15} value={form.cnic} onChange={(e) => set('cnic', formatCnic(e.target.value))} />
              <Field id="password" type="password" label="Temporary Password" icon={LOCK_ICON} minLength={8} required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />

              <div className="mb-5">
                <label className="mb-1.5 block text-sm font-semibold text-ink">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => {
                    const newRole = e.target.value as typeof form.role;
                    setForm((f) => ({ ...f, role: newRole, zone_id: '', branch_id: '', designation: '' }));
                    setShowStaffZoneSelector(newRole === 'staff' || newRole === 'rider');
                    setShowDesignationSelector(newRole === 'staff');
                    setShowStaffBranchSelector(false);
                  }}
                  className="h-11 w-full rounded-lg border-[1.5px] border-input bg-[#FBFCFE] px-3 text-sm text-ink outline-none focus:border-ring"
                >
                  <option value="staff">Staff (counter/office)</option>
                  <option value="rider">Rider (delivery)</option>
                </select>
              </div>

              {showStaffZoneSelector && (
                <div className="mb-5">
                  <label className="mb-1.5 block text-sm font-semibold text-ink">Zone</label>
                  <select
                    value={form.zone_id}
                    onChange={(e) => {
                      const selectedZoneId = e.target.value;
                      setForm((f) => ({ ...f, zone_id: selectedZoneId, branch_id: '' }));
                      filterBranches(selectedZoneId);
                      setShowStaffBranchSelector(selectedZoneId !== '');
                    }}
                    className="h-11 w-full rounded-lg border-[1.5px] border-input bg-[#FBFCFE] px-3 text-sm text-ink outline-none focus:border-ring"
                  >
                    <option value="">Select a zone</option>
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>
              )}

              {showStaffBranchSelector && (
                <div className="mb-5">
                  <label className="mb-1.5 block text-sm font-semibold text-ink">Branch</label>
                  <select
                    value={form.branch_id}
                    onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                    className="h-11 w-full rounded-lg border-[1.5px] border-input bg-[#FBFCFE] px-3 text-sm text-ink outline-none focus:border-ring"
                  >
                    <option value="">Select a branch</option>
                    {filteredBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {showDesignationSelector && (
                <div className="mb-5">
                  <label className="mb-1.5 block text-sm font-semibold text-ink">Designation</label>
                  <select
                    value={form.designation}
                    onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                    className="h-11 w-full rounded-lg border-[1.5px] border-input bg-[#FBFCFE] px-3 text-sm text-ink outline-none focus:border-ring"
                  >
                    <option value="">Select a designation</option>
                    <option value="manager">Manager</option>
                    <option value="operator">Operator</option>
                  </select>
                </div>
              )}

              {error && <p className="col-span-full mb-4 text-sm text-destructive">{error}</p>}

              <div className="col-span-full">
                <Button type="submit" variant="navy" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Account'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Team accounts</CardTitle>
            <CardDescription>{users.length} accounts</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : users.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No staff or riders onboarded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold text-ink">{u.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.phone}</TableCell>
                    <TableCell><Badge variant="info" className="capitalize">{u.role.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-right">
                      {u.role === 'staff' || u.role === 'rider' || u.role === 'customer' ? (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteUser(u.id)}>
                          Delete
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ id, label, icon, ...props }: {
  id: string; label: string; icon?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
        <input id={id} className="h-11 w-full rounded-lg border-[1.5px] border-input bg-[#FBFCFE] pl-10 pr-3 text-sm text-ink outline-none focus:border-ring" {...props} />
      </div>
    </div>
  );
}