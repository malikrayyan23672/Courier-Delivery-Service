'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutGrid, Package, Truck, Box, Warehouse, Bike, Users, MapPin, Map, BarChart3,
  Bell, Search, Menu, LogOut, Plus, Building2, AlertTriangle, CheckCircle2, Clock,
  ArrowUpRight, Activity, PackageCheck, RefreshCw, ChevronRight,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import {
  ApiError,
  listAllOrders,
  listRiders,
  listStaffOrders,
  listStaffRiders,
  Order as ApiOrder,
  StaffRider,
  RiderCard,
  ManagerProfile,
  getManagerProfile,
  getBranchDetails,
  BranchDetails,
  getHubInboundQueue,
  getHubDispatchQueue,
  getHubManifestHistory,
  getHubAgingParcels,
  getHubAnalytics,
  scanHubInbound,
  HubOrderSummary,
  HubAgingOrder,
  HubManifestSummary,
  HubAnalytics,
} from '@/lib/api';
import { ChartCard } from '@/components/charts/ChartCard';
import { TrendLine } from '@/components/charts/TrendLine';
import { ComparisonBars } from '@/components/charts/ComparisonBars';
import {
  INITIAL_PICKUPS, INITIAL_DELIVERIES, STAFF, ZONES, ACTIVITY, ALERTS,
  Pickup, Delivery,
} from './branch-data';
import { Pill, AvatarChip, KpiCard, StatStrip, Toasts } from './branch-ui';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type View = 'overview' | 'pickups' | 'deliveries' | 'parcelops' | 'warehouse' | 'riders' | 'staff' | 'servicearea' | 'map' | 'reports' | 'alerts';

const NAV_SECTIONS: { label: string; items: { view: View; label: string; icon: React.ElementType }[] }[] = [
  { label: 'Operations', items: [
    { view: 'overview', label: 'Overview', icon: LayoutGrid },
    { view: 'pickups', label: 'Pickups', icon: Package },
    { view: 'deliveries', label: 'Deliveries', icon: Truck },
    { view: 'parcelops', label: 'Parcel Operations', icon: Box },
    { view: 'warehouse', label: 'Warehouse', icon: Warehouse },
  ]},
  { label: 'Team', items: [
    { view: 'riders', label: 'Riders', icon: Bike },
    { view: 'staff', label: 'Staff', icon: Users },
  ]},
  { label: 'Coverage', items: [
    { view: 'servicearea', label: 'Service Area', icon: MapPin },
    { view: 'map', label: 'Live Map', icon: Map },
  ]},
  { label: 'Insights', items: [
    { view: 'reports', label: 'Reports', icon: BarChart3 },
    { view: 'alerts', label: 'Alerts', icon: Bell },
  ]},
];

const PAGE_META: Record<View, { title: string; sub: string }> = {
  overview: { title: 'Overview', sub: 'live operational snapshot' },
  pickups: { title: 'Pickup Management', sub: "today's pickup requests and rider assignment" },
  deliveries: { title: 'Delivery Management', sub: 'every order from ready to delivered' },
  parcelops: { title: 'Parcel Operations', sub: 'scanning, sorting and inter-branch transfers' },
  warehouse: { title: 'Warehouse Management', sub: 'storage capacity and inventory movement' },
  riders: { title: 'Rider Management', sub: 'availability, location and performance' },
  staff: { title: 'Branch Staff', sub: 'roles, attendance and permissions' },
  servicearea: { title: 'Service Area Management', sub: 'zones, postal codes and delivery capabilities' },
  map: { title: 'Live Operations Map', sub: 'real-time positions across the branch coverage area' },
  reports: { title: 'Reports & Analytics', sub: 'performance trends and branch comparisons' },
  alerts: { title: 'Alerts & Notifications', sub: 'everything flagged for review' },
};

function titleStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function deliveryProgress(status: string) {
  if (status === 'delivered') return 100;
  if (status === 'in_transit') return 65;
  if (status === 'picked_up') return 45;
  if (status === 'assigned') return 25;
  if (status === 'failed' || status === 'cancelled') return 100;
  return 0;
}

function mapOrdersToPickups(orders: ApiOrder[]): Pickup[] {
  return orders.map((order) => {
    const status: Pickup['status'] =
      order.status === 'created' ? 'Pending'
        : order.status === 'assigned' ? 'Assigned'
          : order.status === 'failed' || order.status === 'cancelled' ? 'Failed'
            : 'Picked Up';

    return {
      id: order.tracking_number,
      customer: order.pickup_address?.contact_name || order.dropoff_address?.contact_name || 'Walk-in customer',
      zone: order.pickup_address?.city || order.dropoff_address?.city || 'Branch zone',
      slot: order.created_at ? new Date(order.created_at).toLocaleString() : 'Today',
      rider: order.rider_accepted === false ? null : 'Assigned rider',
      arrival: status === 'Pending' ? 'Not Started' : status === 'Assigned' ? 'En Route' : titleStatus(order.status),
      status,
      fail: status === 'Failed' ? titleStatus(order.status) : undefined,
    };
  });
}

function mapOrdersToDeliveries(orders: ApiOrder[]): Delivery[] {
  return orders.map((order) => {
    const status: Delivery['status'] =
      order.status === 'created' ? 'Ready'
        : order.status === 'delivered' ? 'Delivered'
          : order.status === 'failed' || order.status === 'cancelled' ? 'Failed'
            : 'Out for Delivery';

    return {
      id: order.tracking_number,
      customer: order.dropoff_address?.contact_name || order.pickup_address?.contact_name || 'Customer',
      zone: order.dropoff_address?.city || order.pickup_address?.city || 'Branch zone',
      rider: order.rider_accepted === false ? null : 'Assigned rider',
      progress: deliveryProgress(order.status),
      status,
      proof: order.status === 'delivered' ? 'Recorded' : '-',
    };
  });
}

function mapApiRiders(apiRiders: StaffRider[]): RiderCard[] {
  return apiRiders.map((rider) => ({
    name: rider.full_name,
    vehicle: `${rider.vehicle_type} · ${rider.phone}`,
    status: rider.is_available ? 'online' as const : 'offline' as const,
    score: rider.rating ?? 5,
    success: Math.round((rider.rating ?? 5) * 20),
    deliveries: rider.rating ?? 0,
    gps: rider.is_available ? 'Available for assignment' : 'Unavailable',
  }));
}

const selectCls =
  'h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

// ============================================================
// SIDEBAR ANALYTICS WIDGET
// ============================================================
function BranchPulse({ onlineRiders, totalRiders, pendingPickups, deliveredCount, totalDeliveries }: {
  onlineRiders: number; totalRiders: number; pendingPickups: number; deliveredCount: number; totalDeliveries: number;
}) {
  const successRate = totalDeliveries ? Math.round((deliveredCount / totalDeliveries) * 100) : 91;
  const ridersPct = totalRiders ? Math.round((onlineRiders / totalRiders) * 100) : 0;

  const items = [
    { label: 'Delivery success', value: `${successRate}%`, pct: successRate },
    { label: 'Riders online', value: `${onlineRiders}/${totalRiders}`, pct: ridersPct },
    { label: 'Pending pickups', value: `${pendingPickups}`, pct: Math.min(pendingPickups * 20, 100) },
    { label: 'Warehouse occupancy', value: '72%', pct: 72 },
  ];

  return (
    <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3.5">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-orange" />
        <span className="text-[0.68rem] font-bold uppercase tracking-wide text-white/60">Branch Pulse</span>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((it) => (
          <div key={it.label}>
            <div className="flex items-center justify-between text-[0.7rem] mb-1">
              <span className="text-white/70">{it.label}</span>
              <span className="font-bold text-white">{it.value}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-orange" style={{ width: `${it.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <Separator className="my-3 bg-white/10" />
      <div className="flex flex-col gap-1.5">
        {ALERTS.slice(0, 2).map((a, i) => (
          <div key={i} className="flex items-start gap-2 text-[0.68rem]">
            <AlertTriangle className={`w-3 h-3 mt-0.5 flex-none ${a.sev === 'high' ? 'text-danger' : a.sev === 'medium' ? 'text-[#F2A93B]' : 'text-white/40'}`} />
            <span className="text-white/70 leading-snug">{a.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN CONSOLE
// ============================================================
export function BranchConsole() {
  const { token, role, setToken } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<View>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  const [riders, setRiders] = useState<RiderCard[]>([]);
  const [managerProfile, setManagerProfile] = useState<ManagerProfile>();
  const [branchDetails, setBranchDetails] = useState<BranchDetails>();

  const [pickups, setPickups] = useState<Pickup[]>(INITIAL_PICKUPS);
  const [deliveries, setDeliveries] = useState<Delivery[]>(INITIAL_DELIVERIES);
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  // Hub Operations - real data from the bus/manifest network, replacing the
  // former RECEIVING_QUEUE/DISPATCH_QUEUE/TRANSFER_HISTORY/AGING_PARCELS mocks.
  const [inboundQueue, setInboundQueue] = useState<HubOrderSummary[]>([]);
  const [dispatchQueue, setDispatchQueue] = useState<HubOrderSummary[]>([]);
  const [manifestHistory, setManifestHistory] = useState<HubManifestSummary[]>([]);
  const [agingParcels, setAgingParcels] = useState<HubAgingOrder[]>([]);
  const [hubAnalytics, setHubAnalytics] = useState<HubAnalytics | null>(null);
  const [hubLoading, setHubLoading] = useState(true);
  const [hubError, setHubError] = useState('');

  const [pickupSearch, setPickupSearch] = useState('');
  const [pickupStatusFilter, setPickupStatusFilter] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('');

  const [shelfCells, setShelfCells] = useState<('low' | 'mid' | 'high')[]>([]);
  useEffect(() => {
    const cells: ('low' | 'mid' | 'high')[] = [];
    for (let i = 0; i < 60; i++) {
      const r = Math.random();
      cells.push(r < 0.35 ? 'low' : r < 0.75 ? 'mid' : 'high');
    }
    setShelfCells(cells);
  }, []);

  useEffect(() => {
    if (!token || !role) return;

    setSyncing(true);
    setSyncError('');

    const isAdminScope = role === 'admin' || role === 'super_admin';
    const ordersRequest = isAdminScope ? listAllOrders(token) : listStaffOrders(token);
    const ridersRequest = isAdminScope ? listRiders(token) : listStaffRiders(token);

    Promise.all([ordersRequest, ridersRequest])
      .then(([ordersData, ridersData]) => {
        setPickups(mapOrdersToPickups(ordersData));
        setDeliveries(mapOrdersToDeliveries(ordersData));
        setRiders(mapApiRiders(ridersData));
      })
      .catch((err) => {
        setSyncError(err instanceof ApiError ? err.message : 'Could not sync branch data with backend.');
      })
      .finally(() => setSyncing(false));
  }, [token, role]);

  useEffect(() => {
    if (!token) return;
    setSyncing(true);
    Promise.all([getManagerProfile(token), getBranchDetails(token)])
      .then(([profile, details]) => {
        setManagerProfile(profile);
        setBranchDetails(details);
      })
      .catch((err) => {
        setSyncError(err instanceof ApiError ? err.message : 'could not sync branch details');
      })
      .finally(() => setSyncing(false));
  }, [token]);

  const branchId = branchDetails?.id;

  function loadHubData() {
    if (!token) return;
    setHubLoading(true);
    setHubError('');
    Promise.all([
      getHubInboundQueue(token, branchId),
      getHubDispatchQueue(token, branchId),
      getHubManifestHistory(token, branchId),
      getHubAgingParcels(token, branchId),
      getHubAnalytics(token, branchId),
    ])
      .then(([inbound, dispatch, history, aging, analytics]) => {
        setInboundQueue(inbound);
        setDispatchQueue(dispatch);
        setManifestHistory(history);
        setAgingParcels(aging);
        setHubAnalytics(analytics);
      })
      .catch((err) => setHubError(err instanceof ApiError ? err.message : 'Could not load hub operations data.'))
      .finally(() => setHubLoading(false));
  }

  useEffect(() => {
    loadHubData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, branchId]);

  function toast(msg: string) {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }

  function switchView(v: View) {
    setView(v);
    setSidebarOpen(false);
  }

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  // ---- derived values (computed every render - never goes stale) ----
  const onlineRiders = riders.filter((r) => r.status === 'online').length;
  const busyRiders = riders.filter((r) => r.status === 'busy').length;
  const offlineRiders = riders.filter((r) => r.status === 'offline').length;

  const pendingPickups = pickups.filter((p) => p.status === 'Pending').length;
  const pickedUpCount = pickups.filter((p) => p.status === 'Picked Up').length;
  const pickupProgressPct = pickups.length ? Math.round((pickedUpCount / pickups.length) * 100) : 0;

  const outForDelivery = deliveries.filter((d) => d.status === 'Out for Delivery').length;
  const deliveredCount = deliveries.filter((d) => d.status === 'Delivered').length;
  const failedDeliveries = deliveries.filter((d) => d.status === 'Failed').length;

  const filteredPickups = useMemo(() => pickups.filter((p) => {
    if (pickupStatusFilter && p.status !== pickupStatusFilter) return false;
    const q = pickupSearch.trim().toLowerCase();
    if (q && !(p.customer.toLowerCase().includes(q) || p.zone.toLowerCase().includes(q))) return false;
    return true;
  }), [pickups, pickupSearch, pickupStatusFilter]);

  const filteredDeliveries = useMemo(() => deliveries.filter((d) => {
    if (deliveryStatusFilter && d.status !== deliveryStatusFilter) return false;
    const q = deliverySearch.trim().toLowerCase();
    if (q && !(d.customer.toLowerCase().includes(q) || d.id.toLowerCase().includes(q))) return false;
    return true;
  }), [deliveries, deliverySearch, deliveryStatusFilter]);

  function handleQuickAssign(pickupId: string) {
    const freeRider = riders.find((r) => r.status === 'online');
    if (!freeRider) {
      toast('No available rider right now.');
      return;
    }
    setPickups((prev) => prev.map((p) =>
      p.id === pickupId ? { ...p, rider: freeRider.name, arrival: 'En Route', status: 'Assigned' } : p
    ));
    toast(`${freeRider.name} assigned to ${pickupId}`);
  }

  function handleReschedule(deliveryId: string) {
    setDeliveries((prev) => prev.map((d) =>
      d.id === deliveryId ? { ...d, status: 'Rescheduled' } : d
    ));
    toast(`${deliveryId} rescheduled for next delivery slot.`);
  }

  function handleScan(type: 'Incoming' | 'Outgoing') {
    const val = scanInput.trim();
    if (!val) {
      toast('Enter a tracking ID to scan.');
      return;
    }
    if (type === 'Outgoing') {
      toast('Outbound dispatch happens by loading parcels onto a manifest - see the Bus Network tab in Admin.');
      return;
    }
    if (!token) return;
    setScanning(true);
    scanHubInbound(val, token, branchId)
      .then(() => {
        toast(`Scanned in at hub: ${val}`);
        setScanInput('');
        loadHubData();
      })
      .catch((err) => toast(err instanceof ApiError ? err.message : 'Scan failed.'))
      .finally(() => setScanning(false));
  }

  const meta = PAGE_META[view];
  const branchName = branchDetails?.name || 'Lahore Central Branch';
  const initials = (managerProfile?.full_name || 'BM').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-page">
      {/* SIDEBAR */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-navy text-white flex flex-col overflow-hidden transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2.5 px-5 py-4 flex-none">
          <Building2 className="w-7 h-7 text-orange" />
          <div>
            <div className="font-display text-base font-extrabold leading-none">RAFTAAR<span className="text-orange">EXPRESS</span></div>
            <div className="text-[0.6rem] tracking-[0.2em] text-white/50 font-semibold mt-1">BRANCH CONSOLE</div>
          </div>
        </div>
        <Separator className="bg-white/10 flex-none" />

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 py-3 flex flex-col gap-1">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="text-[0.68rem] font-bold uppercase tracking-wide text-white/40 px-2.5 mb-1.5 mt-3">{section.label}</div>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.view}
                      onClick={() => switchView(item.view)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                        view === item.view ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-none" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.view === 'pickups' && pendingPickups > 0 && (
                        <span className="text-[0.66rem] font-bold px-1.5 py-0.5 rounded-full bg-white/15 text-white">{pendingPickups}</span>
                      )}
                      {item.view === 'deliveries' && outForDelivery > 0 && (
                        <span className="text-[0.66rem] font-bold px-1.5 py-0.5 rounded-full bg-white/15 text-white">{outForDelivery}</span>
                      )}
                      {item.view === 'riders' && (
                        <span className="text-[0.66rem] font-bold px-1.5 py-0.5 rounded-full bg-white/15 text-white">{onlineRiders + busyRiders}</span>
                      )}
                      {item.view === 'alerts' && (
                        <span className="text-[0.66rem] font-bold px-1.5 py-0.5 rounded-full bg-danger text-white">{ALERTS.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex-none p-3.5 flex flex-col gap-3 border-t border-white/10">
          <BranchPulse
            onlineRiders={onlineRiders}
            totalRiders={riders.length}
            pendingPickups={pendingPickups}
            deliveredCount={deliveredCount}
            totalDeliveries={deliveries.length}
          />
          <div className="text-[0.66rem] text-white/50 px-1">
            {branchDetails?.address}
            <div className="text-white/70 font-semibold mt-0.5">LHE-CTR-01 · Punjab Region</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-line px-5 md:px-8 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen((s) => !s)} className="lg:hidden p-2 text-ink hover:bg-muted rounded-lg" aria-label="Toggle menu">
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-semibold text-ink">{branchName}</span>
              <ChevronRight className="w-3 h-3" />
              <span>{meta.title}</span>
            </div>
            <h1 className="font-display text-lg font-bold text-ink truncate leading-tight">{meta.title}</h1>
            <div className="text-xs text-muted-foreground truncate">{meta.sub}</div>
          </div>

          {(view === 'pickups' || view === 'deliveries') && (
            <div className="relative hidden sm:block w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={view === 'pickups' ? 'Search customer or zone…' : 'Search customer or order ID…'}
                value={view === 'pickups' ? pickupSearch : deliverySearch}
                onChange={(e) => view === 'pickups' ? setPickupSearch(e.target.value) : setDeliverySearch(e.target.value)}
              />
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-ink">
                <Bell className="w-4.5 h-4.5" />
                {ALERTS.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-danger text-white text-[0.6rem] font-bold flex items-center justify-center">{ALERTS.length}</span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALERTS.slice(0, 5).map((a, i) => (
                <DropdownMenuItem key={i} className="items-start gap-2 py-2" onClick={() => switchView('alerts')}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-none ${a.sev === 'high' ? 'text-danger' : a.sev === 'medium' ? 'text-[#F2A93B]' : 'text-muted-foreground'}`} />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{a.title}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{a.time}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg hover:bg-muted p-1.5 pr-2 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-navy text-white text-xs font-bold">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm font-semibold text-ink">{managerProfile?.full_name ?? 'Branch Manager'}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="text-sm font-bold text-ink">{managerProfile?.full_name ?? 'Branch Manager'}</div>
                <div className="text-xs font-normal text-muted-foreground">{managerProfile?.phone ?? '—'}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => switchView('staff')}>
                <Users className="w-4 h-4 mr-2" /> My branch team
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchView('reports')}>
                <BarChart3 className="w-4 h-4 mr-2" /> Branch reports
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-danger focus:text-danger">
                <LogOut className="w-4 h-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => switchView('pickups')} className="hidden sm:flex gap-1.5">
            <Plus className="w-4 h-4" />
            New Pickup
          </Button>
        </header>

        <div className="flex-1 p-5 md:p-8 flex flex-col gap-6">
          {(syncing || syncError) && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              syncError ? 'bg-[#FBEAE7] border-danger/30 text-danger' : 'bg-[#EAF1FC] border-[#2563EB]/20 text-navy'
            }`}>
              {syncError || 'Syncing branch data with backend...'}
            </div>
          )}

          {view === 'overview' && (
            <OverviewView managerProfile={managerProfile} branchDetails={branchDetails} pendingPickups={pendingPickups} pickedUpCount={pickedUpCount}
              outForDelivery={outForDelivery} deliveredCount={deliveredCount} failedDeliveries={failedDeliveries}
              onlineRiders={onlineRiders} busyRiders={busyRiders} switchView={switchView} toast={toast} />
          )}

          {view === 'pickups' && (
            <PickupsView pickups={filteredPickups} total={pickups.length} pending={pendingPickups}
              assigned={pickups.filter(p=>p.status==='Assigned').length} done={pickedUpCount}
              failed={pickups.filter(p=>p.status==='Failed').length} progressPct={pickupProgressPct}
              search={pickupSearch} setSearch={setPickupSearch}
              statusFilter={pickupStatusFilter} setStatusFilter={setPickupStatusFilter}
              onQuickAssign={handleQuickAssign} />
          )}

          {view === 'deliveries' && (
            <DeliveriesView deliveries={filteredDeliveries}
              ready={deliveries.filter(d=>d.status==='Ready').length} out={outForDelivery}
              done={deliveredCount} failed={failedDeliveries}
              search={deliverySearch} setSearch={setDeliverySearch}
              statusFilter={deliveryStatusFilter} setStatusFilter={setDeliveryStatusFilter}
              onReschedule={handleReschedule} />
          )}

          {view === 'parcelops' && (
            <ParcelOpsView
              scanInput={scanInput} setScanInput={setScanInput} scanning={scanning}
              inboundQueue={inboundQueue} dispatchQueue={dispatchQueue} manifestHistory={manifestHistory}
              hubLoading={hubLoading} hubError={hubError}
              onScan={handleScan} toast={toast}
            />
          )}

          {view === 'warehouse' && <WarehouseView shelfCells={shelfCells} agingParcels={agingParcels} hubLoading={hubLoading} />}

          {view === 'riders' && <RidersView riders={riders} onlineRiders={onlineRiders} busyRiders={busyRiders} offlineRiders={offlineRiders} toast={toast} />}

          {view === 'staff' && <StaffView />}

          {view === 'servicearea' && <ServiceAreaView />}

          {view === 'map' && <MapView riders={riders} />}

          {view === 'reports' && <ReportsView riders={riders} hubAnalytics={hubAnalytics} hubLoading={hubLoading} />}

          {view === 'alerts' && <AlertsView />}
        </div>
      </div>

      <Toasts toasts={toasts} />
    </div>
  );
}

// ============================================================
// VIEW: OVERVIEW
// ============================================================
function OverviewView({ managerProfile, branchDetails, pendingPickups, pickedUpCount, outForDelivery, deliveredCount, failedDeliveries, onlineRiders, busyRiders, switchView, toast }: any) {
  const kpis = [
    { icon: <Package className="w-4.5 h-4.5" />, bg: '#2563EB', label: 'Total Shipments Today', num: 412, trend: '+8% vs yesterday', trendColor: '#1E8E5A' },
    { icon: <Clock className="w-4.5 h-4.5" />, bg: '#F2A93B', label: 'Pending Pickups', num: pendingPickups, trend: 'Needs assignment', trendColor: '#B8710A' },
    { icon: <PackageCheck className="w-4.5 h-4.5" />, bg: '#1E8E5A', label: 'Picked Up Parcels', num: pickedUpCount, trend: 'On schedule', trendColor: '#1E8E5A' },
    { icon: <Truck className="w-4.5 h-4.5" />, bg: '#F2A93B', label: 'Out for Delivery', num: outForDelivery, trend: 'Riders en route', trendColor: '#B8710A' },
    { icon: <CheckCircle2 className="w-4.5 h-4.5" />, bg: '#1E8E5A', label: 'Delivered Orders', num: deliveredCount, trend: '91% success rate', trendColor: '#1E8E5A' },
    { icon: <AlertTriangle className="w-4.5 h-4.5" />, bg: '#D8432C', label: 'Failed Deliveries', num: failedDeliveries, trend: 'Review reasons', trendColor: '#D8432C' },
    { icon: <Bike className="w-4.5 h-4.5" />, bg: '#1E8E5A', label: 'Available Riders', num: onlineRiders, trend: 'Ready for dispatch', trendColor: '#1E8E5A' },
    { icon: <Bike className="w-4.5 h-4.5" />, bg: '#F2A93B', label: 'Busy Riders', num: busyRiders, trend: 'On active routes', trendColor: '#B8710A' },
    { icon: <Warehouse className="w-4.5 h-4.5" />, bg: '#173868', label: 'Warehouse Capacity', num: '72%', trend: 'Approaching limit', trendColor: '#B8710A' },
  ];

  const quickActions = [
    { icon: <Clock className="w-4 h-4" />, label: 'Create Pickup Request', msg: 'Pickup request created.' },
    { icon: <Bike className="w-4 h-4" />, label: 'Assign Rider', msg: 'Rider assignment panel opened.' },
    { icon: <Box className="w-4 h-4" />, label: 'Scan Parcel', goto: 'parcelops' as View },
    { icon: <Truck className="w-4 h-4" />, label: 'Dispatch Shipment', msg: 'Shipment queued for dispatch.' },
    { icon: <Users className="w-4 h-4" />, label: 'Add Staff', goto: 'staff' as View },
    { icon: <BarChart3 className="w-4 h-4" />, label: 'Generate Report', goto: 'reports' as View },
  ];

  return (
    <>
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-6 justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h2 className="font-display text-xl font-bold text-ink">{branchDetails?.name || 'Lahore Central Branch'}</h2>
              <Badge variant="success">● Active</Badge>
              <Badge variant="info">Regional Hub</Badge>
            </div>
            <div className="text-xs text-muted-foreground mb-2">Branch Code: LHE-CTR-01</div>
            <p className="text-sm text-ink max-w-xl leading-relaxed">
              {branchDetails?.address || '12-B, Gulberg III, Main Boulevard, Lahore, Punjab, Pakistan — serving Lahore metro and surrounding districts.'}
            </p>
            <a href="https://www.google.com/maps/search/?api=1&query=12-B%20Gulberg%20III%20Main%20Boulevard%20Lahore%20Pakistan" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-navy text-white text-xs font-bold px-3 py-2 rounded-lg mt-3 no-underline">
              <MapPin className="w-3.5 h-3.5" />
              Open in Google Maps
            </a>
            <div className="grid sm:grid-cols-3 gap-4 mt-5">
              <div><div className="text-[0.68rem] text-muted-foreground font-semibold uppercase">Working Hours</div><div className="text-sm text-ink mt-0.5">Mon–Sat · 8AM–10PM</div></div>
              <div><div className="text-[0.68rem] text-muted-foreground font-semibold uppercase">Branch Type</div><div className="text-sm text-ink mt-0.5">Regional Hub</div></div>
              <div><div className="text-[0.68rem] text-muted-foreground font-semibold uppercase">Today's Status</div><div className="text-sm text-ink mt-0.5">Operating normally</div></div>
            </div>
          </div>
          <div className="lg:w-64 flex-none bg-page rounded-xl p-4">
            <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Branch Manager</div>
            <div className="flex items-center gap-2.5">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-navy text-white font-bold text-sm">
                  {(managerProfile?.full_name || 'BM').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-bold text-sm text-ink">{managerProfile?.full_name ?? 'Branch Manager'}</div>
                <div className="text-xs text-muted-foreground">{managerProfile?.phone ?? '—'}</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">On-site since 6:45 AM. Reachable on radio channel 3 for escalations.</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map(({ icon, ...k }) => <KpiCard key={k.label} icon={icon} {...k} />)}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Real-time events across the branch</CardDescription>
          </CardHeader>
          <div className="flex flex-col gap-3">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-none text-white" style={{ background: a.color }}>
                  {a.icon === 'box' ? <Box className="w-3.5 h-3.5" /> : a.icon === 'rider' ? <Bike className="w-3.5 h-3.5" /> : a.icon === 'truck' ? <Truck className="w-3.5 h-3.5" /> : a.icon === 'check' ? <CheckCircle2 className="w-3.5 h-3.5" /> : a.icon === 'alert' ? <AlertTriangle className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink">{a.text}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Common branch tasks</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-2 gap-2.5">
            {quickActions.map((q) => (
              <button key={q.label}
                onClick={() => { if (q.msg) toast(q.msg); if (q.goto) switchView(q.goto); }}
                className="flex flex-col items-center gap-2 border border-line rounded-xl p-4 text-xs font-semibold text-ink hover:border-orange hover:bg-page transition-colors text-center"
              >
                {q.icon}
                {q.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <CardTitle className="text-base">Priority Alerts</CardTitle>
            <CardDescription>Needs branch manager attention</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="text-orange font-bold" onClick={() => switchView('alerts')}>
            View all <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
        <div className="flex flex-col gap-2.5">
          {ALERTS.slice(0, 3).map((a, i) => <AlertCard key={i} alert={a} />)}
        </div>
      </Card>
    </>
  );
}

// ============================================================
// VIEW: PICKUPS
// ============================================================
function PickupsView({ pickups, total, pending, assigned, done, failed, progressPct, search, setSearch, statusFilter, setStatusFilter, onQuickAssign }: any) {
  return (
    <Card className="p-5">
      <StatStrip items={[
        { num: total, label: "Today's Requests" },
        { num: pending, label: 'Pending Assignment' },
        { num: assigned, label: 'Rider Assigned' },
        { num: done, label: 'Picked Up' },
        { num: failed, label: 'Failed Attempts' },
      ]} />

      <div className="mt-4 mb-4">
        <div className="text-xs font-semibold text-muted-foreground mb-1.5">Pickup completion today</div>
        <Progress value={progressPct} className="h-2 [&>div]:bg-orange" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" type="text" placeholder="Search customer or zone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
          <option value="">Any status</option>
          <option>Pending</option><option>Assigned</option><option>Picked Up</option><option>Failed</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Pickup ID</TableHead>
              <TableHead>Customer / Location</TableHead>
              <TableHead>Time Slot</TableHead>
              <TableHead>Assigned Rider</TableHead>
              <TableHead>Rider Status</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pickups.map((p: Pickup) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs text-ink">{p.id}</TableCell>
                <TableCell>{p.customer}<div className="text-xs text-muted-foreground">{p.zone}</div></TableCell>
                <TableCell className="text-muted-foreground">{p.slot}</TableCell>
                <TableCell><AvatarChip name={p.rider} /></TableCell>
                <TableCell>{p.rider ? <Pill status={p.arrival} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <Pill status={p.status} />
                  {p.fail && <div className="text-xs text-muted-foreground mt-1">{p.fail}</div>}
                </TableCell>
                <TableCell>
                  {p.status === 'Pending'
                    ? <Button size="sm" variant="outline" className="text-orange" onClick={() => onQuickAssign(p.id)}>Quick Assign</Button>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
              </TableRow>
            ))}
            {pickups.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No pickups match your filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

// ============================================================
// VIEW: DELIVERIES
// ============================================================
function DeliveriesView({ deliveries, ready, out, done, failed, search, setSearch, statusFilter, setStatusFilter, onReschedule }: any) {
  return (
    <Card className="p-5">
      <StatStrip items={[
        { num: ready, label: 'Ready for Delivery' },
        { num: out, label: 'Out for Delivery' },
        { num: done, label: 'Completed' },
        { num: failed, label: 'Failed Attempts' },
      ]} />

      <div className="flex flex-col sm:flex-row gap-3 my-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" type="text" placeholder="Search customer or order ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
          <option value="">Any status</option>
          <option>Ready</option><option>Out for Delivery</option><option>Delivered</option><option>Failed</option><option>Rescheduled</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Order ID</TableHead>
              <TableHead>Customer / Zone</TableHead>
              <TableHead>Assigned Rider</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Proof</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((d: Delivery) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs text-ink">{d.id}</TableCell>
                <TableCell>{d.customer}<div className="text-xs text-muted-foreground">{d.zone}</div></TableCell>
                <TableCell><AvatarChip name={d.rider} /></TableCell>
                <TableCell className="min-w-[100px]">
                  <div className="h-1.5 bg-line rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${d.progress}%`, background: d.status === 'Failed' ? '#D8432C' : '#F2701A' }} />
                  </div>
                </TableCell>
                <TableCell><Pill status={d.status} /></TableCell>
                <TableCell className="text-muted-foreground">{d.proof}</TableCell>
                <TableCell>
                  {d.status === 'Failed'
                    ? <Button size="sm" variant="outline" className="text-orange" onClick={() => onReschedule(d.id)}>Reschedule</Button>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
              </TableRow>
            ))}
            {deliveries.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No deliveries match your filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

// ============================================================
// VIEW: PARCEL OPERATIONS
// ============================================================
function ParcelOpsView({
  scanInput, setScanInput, scanning, inboundQueue, dispatchQueue, manifestHistory, hubLoading, hubError, onScan, toast,
}: {
  scanInput: string; setScanInput: (v: string) => void; scanning: boolean;
  inboundQueue: HubOrderSummary[]; dispatchQueue: HubOrderSummary[]; manifestHistory: HubManifestSummary[];
  hubLoading: boolean; hubError: string;
  onScan: (type: 'Incoming' | 'Outgoing') => void; toast: (msg: string) => void;
}) {
  return (
    <>
      {hubError && <div className="rounded-lg border border-danger/30 bg-[#FBEAE7] px-4 py-3 text-sm text-danger">{hubError}</div>}

      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base">Scan Parcel</CardTitle>
          <CardDescription>Hub receiving scan - moves a parcel to IN_HUB</CardDescription>
        </CardHeader>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Input type="text" placeholder="Enter or scan tracking number…" value={scanInput} onChange={(e) => setScanInput(e.target.value)} className="flex-1" />
          <Button onClick={() => onScan('Incoming')} variant="navy" disabled={scanning}>{scanning ? 'Scanning…' : 'Scan Incoming'}</Button>
          <Button onClick={() => onScan('Outgoing')} variant="outline">Scan Outgoing</Button>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="text-base">Receiving Queue</CardTitle>
            <CardDescription>Picked up, en route to this hub - not yet scanned in</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Tracking ID</TableHead><TableHead>Destination</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inboundQueue.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.tracking_number}</TableCell>
                  <TableCell>{r.dropoff_city || '—'}</TableCell>
                  <TableCell><Pill status={r.status} /></TableCell>
                </TableRow>
              ))}
              {!hubLoading && inboundQueue.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Nothing awaiting hub scan.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
        <Card className="p-5">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="text-base">Dispatch Queue</CardTitle>
            <CardDescription>Scanned in - ready to load onto an outbound manifest</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Tracking ID</TableHead><TableHead>Destination</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dispatchQueue.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.tracking_number}</TableCell>
                  <TableCell>{r.dropoff_city || '—'}</TableCell>
                  <TableCell><Pill status={r.status} /></TableCell>
                </TableRow>
              ))}
              {!hubLoading && dispatchQueue.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Nothing ready to dispatch.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Manifest History</CardTitle>
            <CardDescription>Bus manifests through this hub</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toast('Damaged parcel report submitted.')}>Report Damaged</Button>
            <Button size="sm" variant="outline" onClick={() => toast('Missing parcel alert raised to ops team.')}>Report Missing</Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Manifest</TableHead><TableHead>Operator</TableHead><TableHead>Route</TableHead><TableHead>Items</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {manifestHistory.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.manifest_number || m.id.slice(0, 8)}</TableCell>
                <TableCell>{m.operator_name || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{m.origin_city} → {m.destination_city}</TableCell>
                <TableCell>{m.item_count}</TableCell>
                <TableCell><Pill status={m.status} /></TableCell>
              </TableRow>
            ))}
            {!hubLoading && manifestHistory.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No manifests through this hub yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

// ============================================================
// VIEW: WAREHOUSE
// ============================================================
function WarehouseView({ shelfCells, agingParcels, hubLoading }: { shelfCells: ('low' | 'mid' | 'high')[]; agingParcels: HubAgingOrder[]; hubLoading: boolean }) {
  const shelfColor = { low: '#EAF7EF', mid: '#FDF1DD', high: '#FBEAE7' };
  const shelfBorder = { low: '#1E8E5A', mid: '#F2A93B', high: '#D8432C' };
  return (
    <>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base">Storage Capacity</CardTitle>
            <CardDescription>Rack occupancy across the warehouse floor</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-10 gap-1.5">
            {shelfCells.length === 0
              ? Array.from({ length: 60 }).map((_, i) => <div key={i} className="aspect-square rounded bg-line animate-pulse" />)
              : shelfCells.map((c, i) => (
                <div key={i} className="aspect-square rounded" style={{ background: shelfColor[c], border: `1px solid ${shelfBorder[c]}` }} />
              ))}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: shelfColor.low, border: `1px solid ${shelfBorder.low}` }} />Low</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: shelfColor.mid, border: `1px solid ${shelfBorder.mid}` }} />Mid</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: shelfColor.high, border: `1px solid ${shelfBorder.high}` }} />Near capacity</span>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base">Capacity Usage</CardTitle>
          </CardHeader>
          <div className="flex items-center gap-6">
            <div className="w-28 h-28 rounded-full flex items-center justify-center flex-none" style={{ background: 'conic-gradient(#2563EB 0% 72%, #E4E8F0 72% 100%)' }}>
              <div className="w-20 h-20 rounded-full bg-white flex flex-col items-center justify-center">
                <b className="text-lg font-display">72%</b><span className="text-xs text-muted-foreground">used</span>
              </div>
            </div>
            <ul className="text-sm space-y-1.5">
              <li className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-sm inline-block bg-[#2563EB]" />Occupied <b>72%</b></li>
              <li className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-sm inline-block bg-line" />Free <b>28%</b></li>
            </ul>
          </div>
          <div className="mt-5">
            <StatStrip items={[
              { num: '1,860', label: 'Total Stored Parcels' },
              { num: 140, label: 'Incoming Inventory' },
              { num: 158, label: 'Outgoing Inventory' },
              { num: agingParcels.length, label: 'Aging Parcels' },
            ]} />
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="text-base">Aging Parcels</CardTitle>
          <CardDescription>Parcels sitting longest without movement</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Tracking ID</TableHead><TableHead>Status</TableHead><TableHead>Hours Aging</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agingParcels.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.tracking_number}</TableCell>
                <TableCell><Pill status={a.status} /></TableCell>
                <TableCell><Pill status={a.hours_aging > 24 ? 'red' : 'amber'} label={`${a.hours_aging}h`} /></TableCell>
              </TableRow>
            ))}
            {!hubLoading && agingParcels.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No parcels aging past the threshold.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

// ============================================================
// VIEW: RIDERS
// ============================================================
function RidersView({ riders, onlineRiders, busyRiders, offlineRiders, toast }: any) {
  return (
    <>
      <StatStrip items={[
        { num: riders.length, label: 'Total Riders Assigned' },
        { num: onlineRiders, label: 'Online / Available' },
        { num: busyRiders, label: 'On Delivery' },
        { num: offlineRiders, label: 'Offline' },
      ]} />
      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base">Rider Roster</CardTitle>
          <CardDescription>Availability, live status and performance</CardDescription>
        </CardHeader>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {riders.map((r: RiderCard) => {
            const dotColor = r.status === 'online' ? '#1E8E5A' : r.status === 'busy' ? '#F2A93B' : '#8A94A6';
            return (
              <div key={r.name} className="border border-line rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center font-bold text-sm flex-none">
                    {r.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: dotColor }} />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-ink">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.vehicle}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs mb-3">
                  <div><div className="text-muted-foreground">Status</div><div className="font-semibold text-ink">{r.status === 'online' ? 'Available' : r.status === 'busy' ? 'On Delivery' : 'Offline'}</div></div>
                  <div><div className="text-muted-foreground">Success Rate</div><div className="font-semibold text-ink">{r.success}%</div></div>
                  <div className="col-span-2"><div className="text-muted-foreground">GPS Location</div><div className="font-semibold text-ink text-[0.72rem]">{r.gps}</div></div>
                  <div className="col-span-2"><div className="text-muted-foreground">Performance</div><div className="text-orange">{'★'.repeat(Math.round(r.score))}{'☆'.repeat(5 - Math.round(r.score))}</div></div>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-xs text-muted-foreground">{r.deliveries} deliveries today</span>
                  <Button size="sm" variant="outline" className="text-orange" onClick={() => toast(`Shipment assignment started for ${r.name}.`)}>Assign</Button>
                </div>
              </div>
            );
          })}
          {riders.length === 0 && <div className="col-span-full text-sm text-muted-foreground py-8 text-center">No riders assigned yet.</div>}
        </div>
      </Card>
    </>
  );
}

// ============================================================
// VIEW: STAFF
// ============================================================
function StaffView() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <CardTitle className="text-base">Branch Staff</CardTitle>
          <CardDescription>Roles, attendance and permissions</CardDescription>
        </div>
        <Button variant="navy" size="sm"><Plus className="w-4 h-4 mr-1" /> Add Staff</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Attendance</TableHead><TableHead>Contact</TableHead><TableHead>Permissions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {STAFF.map((s) => (
            <TableRow key={s.name}>
              <TableCell><AvatarChip name={s.name} /></TableCell>
              <TableCell>{s.role}</TableCell>
              <TableCell><Pill status={s.attendance} /></TableCell>
              <TableCell className="text-muted-foreground">{s.contact}</TableCell>
              <TableCell><Pill status="blue" label={s.perm} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================
// VIEW: SERVICE AREA
// ============================================================
function ServiceAreaView() {
  return (
    <Card className="p-5">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-base">Coverage Zones</CardTitle>
        <CardDescription>Cities, postal codes and delivery capabilities served by this branch</CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Zone</TableHead><TableHead>Postal Codes</TableHead><TableHead>Delivery Radius</TableHead><TableHead>Same-Day</TableHead><TableHead>Express</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ZONES.map((z) => (
            <TableRow key={z.zone}>
              <TableCell className="font-bold text-ink">{z.zone}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{z.codes}</TableCell>
              <TableCell>{z.radius}</TableCell>
              <TableCell><Pill status={z.sameDay ? 'green' : 'gray'} label={z.sameDay ? 'Available' : 'Not available'} /></TableCell>
              <TableCell><Pill status={z.express ? 'blue' : 'gray'} label={z.express ? 'Available' : 'Not available'} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================
// VIEW: MAP
// ============================================================
function MapView({ riders }: { riders: RiderCard[] }) {
  const activeRiders = riders.filter((r) => r.status !== 'offline').slice(0, 7).map((r, i) => ({
    x: 15 + (i * 11) % 80, y: 15 + (i * 23) % 75, busy: r.status === 'busy', name: r.name,
  }));
  const pickupPins = [{ x: 22, y: 30, label: 'PK-70233' }, { x: 70, y: 20, label: 'PK-70234' }];
  const deliveryPins = [{ x: 35, y: 70, label: 'FX-582012' }, { x: 80, y: 60, label: 'FX-582015' }, { x: 55, y: 85, label: 'FX-582020' }];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <CardTitle className="text-base">Live Operations Map</CardTitle>
          <CardDescription>Branch, riders, pickups and deliveries in real time</CardDescription>
        </div>
        <Badge variant="warning">Moderate traffic</Badge>
      </div>
      <div className="relative w-full aspect-[16/9] bg-page rounded-xl overflow-hidden border border-line">
        <MapDot x={50} y={50} color="#0F2648" label="Lahore Central" />
        {activeRiders.map((r) => <MapDot key={r.name} x={r.x} y={r.y} color={r.busy ? '#2563EB' : '#B7BEC9'} label={r.name.split(' ')[0]} />)}
        {pickupPins.map((p) => <MapDot key={p.label} x={p.x} y={p.y} color="#F2A93B" label={p.label} />)}
        {deliveryPins.map((d) => <MapDot key={d.label} x={d.x} y={d.y} color="#1E8E5A" label={d.label} />)}
      </div>
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-navy" />Branch</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-[#2563EB]" />Rider (active)</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-[#B7BEC9]" />Rider (idle)</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-[#F2A93B]" />Pickup</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-success" />Delivery</span>
      </div>
    </Card>
  );
}

function MapDot({ x, y, color, label }: { x: number; y: number; color: string; label: string }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: color }} />
      <span className="text-[0.62rem] font-semibold text-ink bg-white/90 px-1.5 py-0.5 rounded whitespace-nowrap">{label}</span>
    </div>
  );
}

// ============================================================
// VIEW: REPORTS
// ============================================================
function ReportsView({ riders, hubAnalytics, hubLoading }: { riders: RiderCard[]; hubAnalytics: HubAnalytics | null; hubLoading: boolean }) {
  const topRiders = [...riders].sort((a, b) => b.deliveries - a.deliveries).slice(0, 6);
  const comparisons = [
    { label: 'Delivery Success Rate', branch: 91, network: 87 },
    { label: 'On-Time Pickup Rate', branch: 88, network: 84 },
    { label: 'Avg. Delivery Time (lower is better)', branch: 74, network: 80 },
  ];
  const vendorScoreData = (hubAnalytics?.vendor_scores ?? []).map((v) => ({ label: v.operator_name, on_time_pct: v.on_time_pct }));

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Parcels through this hub" description="Scanned in vs. dispatched, last 14 days" loading={hubLoading} empty={!hubAnalytics || hubAnalytics.daily.length === 0}>
          <TrendLine
            data={hubAnalytics?.daily ?? []}
            xKey="date"
            series={[{ key: 'parcels_in', label: 'Parcels in' }, { key: 'parcels_out', label: 'Parcels out' }]}
          />
        </ChartCard>
        <ChartCard title="Bus operator on-time score" description="Departures within 15 min of schedule" loading={hubLoading} empty={vendorScoreData.length === 0} emptyMessage="No dispatched manifests yet.">
          <ComparisonBars data={vendorScoreData} categoryKey="label" series={[{ key: 'on_time_pct', label: 'On-time %' }]} valueFormatter={(v) => `${v}%`} />
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="text-base">Rider Productivity</CardTitle>
            <CardDescription>Top performers this week</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Rider</TableHead><TableHead>Deliveries</TableHead><TableHead>Success Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topRiders.map((r) => (
                <TableRow key={r.name}>
                  <TableCell><AvatarChip name={r.name} /></TableCell>
                  <TableCell>{r.deliveries}</TableCell>
                  <TableCell><Pill status={r.success >= 93 ? 'green' : 'amber'} label={`${r.success}%`} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base">Branch vs. Network Average</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-4">
            {comparisons.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs font-semibold text-ink mb-1"><span>{c.label}</span><span>{c.branch}% vs {c.network}%</span></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden mb-1"><div className="h-full bg-orange" style={{ width: `${c.branch}%` }} /></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden"><div className="h-full bg-[#B7BEC9]" style={{ width: `${c.network}%` }} /></div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground mt-1"><span className="text-orange font-bold">■</span> This branch &nbsp; <span className="text-[#B7BEC9] font-bold">■</span> Network average</div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base">Summary Metrics</CardTitle>
        </CardHeader>
        <StatStrip items={[
          { num: '28 min', label: 'Avg Delivery Time' },
          { num: '89%', label: 'Pickup Efficiency' },
          { num: 'Rs 486,300', label: 'COD Collected Today' },
          { num: 6, label: 'Customer Complaints (7d)' },
          { num: '#2', label: 'Network Rank of 8' },
        ]} />
      </Card>
    </>
  );
}

// ============================================================
// VIEW: ALERTS
// ============================================================
function AlertsView() {
  return (
    <Card className="p-5">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-base">Alerts & Notifications</CardTitle>
        <CardDescription>Everything flagged for branch manager review</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-2.5">
        {ALERTS.map((a, i) => <AlertCard key={i} alert={a} />)}
      </div>
    </Card>
  );
}

function AlertCard({ alert }: { alert: { sev: string; title: string; msg: string; time: string } }) {
  const border = alert.sev === 'high' ? '#D8432C' : alert.sev === 'medium' ? '#F2A93B' : '#B7BEC9';
  return (
    <div className="flex gap-3 border-l-4 rounded-lg bg-page p-3.5" style={{ borderColor: border }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-none text-white" style={{ background: border }}>
        <AlertTriangle className="w-3.5 h-3.5" />
      </div>
      <div>
        <div className="font-bold text-sm text-ink">{alert.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{alert.msg}</div>
        <div className="text-xs text-muted-foreground/70 mt-1">{alert.time}</div>
      </div>
    </div>
  );
}
