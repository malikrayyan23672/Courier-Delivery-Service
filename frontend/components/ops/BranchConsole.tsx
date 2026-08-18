'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  LayoutGrid, Package, Truck, Box, Warehouse, Bike, Users, MapPin, Map, BarChart3,
  Bell, Search, Menu, LogOut, Plus, Building2, AlertTriangle, CheckCircle2, Clock,
  ArrowUpRight, Activity, PackageCheck, RefreshCw, ChevronRight, Bus, Undo2, Star, Printer,
  Inbox,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import {
  ApiError,
  listAllOrders,
  listRiders,
  listStaffOrders,
  listStaffRiders,
  updateRiderWallet,
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
  getHubRtoQueue,
  hubScan,
  HubScanAction,
  HubScanResult,
  listBusSchedules,
  createBusManifest,
  addManifestItem,
  updateManifestStatus,
  listBusOperators,
  createBusOperator,
  deactivateBusOperator,
  HubOrderSummary,
  HubAgingOrder,
  HubManifestSummary,
  HubManifestItem,
  HubAnalytics,
  HubSnapshot,
  BusSchedule,
  BusOperator,
  VendorScore,
  RiderLocation,
} from '@/lib/api';
import { useRiderLocations } from '@/lib/useRiderLocations';
import { ChartCard } from '@/components/charts/ChartCard';
import { TrendLine } from '@/components/charts/TrendLine';
import { ComparisonBars } from '@/components/charts/ComparisonBars';
import {
  INITIAL_PICKUPS, INITIAL_DELIVERIES, STAFF, ZONES, ACTIVITY, ALERTS,
  Pickup, Delivery,
} from './branch-data';
import { Pill, AvatarChip, KpiCard, StatStrip, Toasts } from './branch-ui';
import { CameraScanButton } from '@/components/CameraScanner';
import { RequestsView } from './RequestsView';

// Leaflet touches window/document at import time - must load client-only,
// never during SSR.
const RiderMap = dynamic(() => import('./RiderMap'), { ssr: false });

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

type View = 'overview' | 'pickups' | 'deliveries' | 'parcelops' | 'manifests' | 'returns' | 'vendors' | 'warehouse' | 'riders' | 'staff' | 'requests' | 'servicearea' | 'map' | 'reports' | 'alerts';

const NAV_SECTIONS: { label: string; items: { view: View; label: string; icon: React.ElementType }[] }[] = [
  { label: 'Operations', items: [
    { view: 'overview', label: 'Overview', icon: LayoutGrid },
    { view: 'pickups', label: 'Pickups', icon: Package },
    { view: 'deliveries', label: 'Deliveries', icon: Truck },
    { view: 'parcelops', label: 'Parcel Operations', icon: Box },
    { view: 'warehouse', label: 'Warehouse', icon: Warehouse },
  ]},
  { label: 'Hub Network', items: [
    { view: 'manifests', label: 'Manifests', icon: Bus },
    { view: 'returns', label: 'Returns / RTO', icon: Undo2 },
    { view: 'vendors', label: 'Bus Vendors', icon: Star },
  ]},
  { label: 'Team', items: [
    { view: 'riders', label: 'Riders', icon: Bike },
    { view: 'staff', label: 'Staff', icon: Users },
    { view: 'requests', label: 'Rider Requests', icon: Inbox },
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
  manifests: { title: 'Manifests', sub: 'create outbound bus manifests, load crates, and receive arrivals' },
  returns: { title: 'Returns / RTO', sub: 'parcels awaiting a return dispatch after failed delivery' },
  vendors: { title: 'Bus Vendors', sub: 'operator on-time performance through this hub' },
  warehouse: { title: 'Warehouse Management', sub: 'storage capacity and inventory movement' },
  riders: { title: 'Rider Management', sub: 'availability, location and performance' },
  staff: { title: 'Branch Staff', sub: 'roles, attendance and permissions' },
  requests: { title: 'Rider Requests', sub: 'availability changes, parcel unlocks and support tickets' },
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
        <Activity className="w-3.5 h-3.5 text-[#db2203]" />
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
              <div className="h-full rounded-full bg-[#db2203]" style={{ width: `${it.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <Separator className="my-3 bg-white/10" />
      <div className="flex flex-col gap-1.5">
        {ALERTS.slice(0, 2).map((a, i) => (
          <div key={i} className="flex items-start gap-2 text-[0.68rem]">
            <AlertTriangle className={`w-3 h-3 mt-0.5 flex-none ${a.sev === 'high' ? 'text-[#db2203]' : a.sev === 'medium' ? 'text-[#F2A93B]' : 'text-white/40'}`} />
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
  const [staffRiders, setStaffRiders] = useState<StaffRider[]>([]);
  const [ridersReload, setRidersReload] = useState(0);
  const [managerProfile, setManagerProfile] = useState<ManagerProfile>();
  const [branchDetails, setBranchDetails] = useState<BranchDetails>();

  const isAdminScope = role === 'admin' || role === 'super_admin';
  const {
    locations: riderLocations,
    loading: riderLocationsLoading,
    error: riderLocationsError,
  } = useRiderLocations(token, { isAdmin: isAdminScope }, view === 'map');

  const [pickups, setPickups] = useState<Pickup[]>(INITIAL_PICKUPS);
  const [deliveries, setDeliveries] = useState<Delivery[]>(INITIAL_DELIVERIES);
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanAction, setScanAction] = useState<HubScanAction>('in');
  const [lastScan, setLastScan] = useState<HubScanResult | null>(null);
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
  const [rtoQueue, setRtoQueue] = useState<HubOrderSummary[]>([]);
  const [schedules, setSchedules] = useState<BusSchedule[]>([]);
  const [manifestBusy, setManifestBusy] = useState(false);

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

    const ordersRequest = isAdminScope ? listAllOrders(token) : listStaffOrders(token);
    const ridersRequest = isAdminScope ? listRiders(token) : listStaffRiders(token);

    Promise.all([ordersRequest, ridersRequest])
      .then(([ordersData, ridersData]) => {
        setPickups(mapOrdersToPickups(ordersData));
        setDeliveries(mapOrdersToDeliveries(ordersData));
        setRiders(mapApiRiders(ridersData));
        setStaffRiders(ridersData);
      })
      .catch((err) => {
        setSyncError(err instanceof ApiError ? err.message : 'Could not sync branch data with backend.');
      })
      .finally(() => setSyncing(false));
  }, [token, role, ridersReload]);

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
      getHubRtoQueue(token, branchId),
      listBusSchedules(token),
    ])
      .then(([inbound, dispatch, history, aging, analytics, rto, allSchedules]) => {
        setInboundQueue(inbound);
        setDispatchQueue(dispatch);
        setManifestHistory(history);
        setAgingParcels(aging);
        setHubAnalytics(analytics);
        setRtoQueue(rto);
        setSchedules(allSchedules);
      })
      .catch((err) => setHubError(err instanceof ApiError ? err.message : 'Could not load hub operations data.'))
      .finally(() => setHubLoading(false));
  }

  // ---- Manifests (outbound dispatch + inbound arrivals) ----
  async function handleCreateManifest(scheduleId: string, coachNumber: string, departureAt?: string): Promise<string | undefined> {
    if (!token) return undefined;
    setManifestBusy(true);
    try {
      const created = await createBusManifest({
        schedule_id: scheduleId || undefined,
        coach_number: coachNumber || undefined,
        departure_at: departureAt ? new Date(departureAt).toISOString() : undefined,
      }, token);
      toast('Manifest created.');
      loadHubData();
      return created.id;
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create manifest.');
      return undefined;
    } finally {
      setManifestBusy(false);
    }
  }

  /** Loads a crate onto a manifest by tracking number - resolves against whichever queue it's coming from (dispatch = normal freight, RTO = a return batch). */
  async function handleLoadCrate(manifestId: string, trackingNumber: string, source: HubOrderSummary[], crateLabelPrefix?: string) {
    if (!token) return;
    const val = trackingNumber.trim().toUpperCase();
    if (!val) { toast('Enter a tracking number to load.'); return; }
    const match = source.find((o) => o.tracking_number.toUpperCase() === val);
    if (!match) { toast(`${val} isn't in the queue for this hub yet.`); return; }
    setManifestBusy(true);
    try {
      await addManifestItem(manifestId, match.id, crateLabelPrefix ? `${crateLabelPrefix}${match.tracking_number}` : undefined, token);
      toast(`Loaded ${match.tracking_number} onto manifest.`);
      loadHubData();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not load crate onto manifest.');
    } finally {
      setManifestBusy(false);
    }
  }

  async function handleDepartManifest(manifestId: string) {
    if (!token) return;
    setManifestBusy(true);
    try {
      await updateManifestStatus(manifestId, 'in_transit', 'in_transit', token);
      toast('Manifest departed and locked.');
      loadHubData();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not depart manifest.');
    } finally {
      setManifestBusy(false);
    }
  }

  async function handleArriveManifest(manifestId: string, scannedItemIds: string[]) {
    if (!token) return;
    setManifestBusy(true);
    try {
      const result = await updateManifestStatus(manifestId, 'arrived', 'arrived', token, scannedItemIds);
      const total = (manifestHistory.find((m) => m.id === manifestId)?.items.length) ?? scannedItemIds.length;
      if (scannedItemIds.length < total) {
        toast(`Manifest received - ${total - scannedItemIds.length} crate(s) missing, logged as a count mismatch.`);
      } else {
        toast('Manifest received - all crates scanned off.');
      }
      loadHubData();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not mark manifest arrived.');
    } finally {
      setManifestBusy(false);
    }
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

  function handleScan() {
    const val = scanInput.trim();
    if (!val) {
      toast('Enter a tracking ID to scan.');
      return;
    }
    if (!token) return;
    setScanning(true);
    hubScan(val, scanAction, token, branchId)
      .then((res) => {
        setLastScan(res);
        toast(`Scanned ${scanAction}: ${val} -> ${res.status.replace(/_/g, ' ')}`);
        setScanInput('');
        loadHubData();
      })
      .catch((err) => toast(err instanceof ApiError ? err.message : 'Scan failed.'))
      .finally(() => setScanning(false));
  }

  // ---- Rider COD wallet controls (branch manager + admin oversight) ----
  async function handleWalletLock(riderId: string) {
    if (!token) return;
    const note = window.prompt('Audit note for locking this wallet (e.g. "Over limit, holds cash overnight"):') || '';
    try {
      await updateRiderWallet(riderId, 'lock', token, { note });
      toast('Rider wallet locked.');
      setRidersReload((r) => r + 1);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not lock wallet.');
    }
  }

  async function handleWalletUnlock(riderId: string) {
    if (!token) return;
    const note = window.prompt('Audit note for unlocking (e.g. "Cash deposited at hub"):') || '';
    try {
      await updateRiderWallet(riderId, 'unlock', token, { note });
      toast('Rider wallet unlocked, cash cleared.');
      setRidersReload((r) => r + 1);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not unlock wallet.');
    }
  }

  async function handleWalletSetLimit(riderId: string, current: number) {
    if (!token) return;
    const raw = window.prompt('New COD holding limit (PKR):', String(current));
    if (!raw) return;
    const limit = parseFloat(raw);
    if (isNaN(limit) || limit < 0) {
      toast('Enter a valid positive limit.');
      return;
    }
    const note = window.prompt('Audit note (optional):') || undefined;
    try {
      await updateRiderWallet(riderId, 'set_limit', token, { note, wallet_limit: limit });
      toast(`Wallet limit updated to PKR ${limit.toLocaleString()}.`);
      setRidersReload((r) => r + 1);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update wallet limit.');
    }
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
          <Building2 className="w-7 h-7 text-[#db2203]" />
          <div>
            <div className="font-display text-base font-extrabold leading-none">RAFTAAR<span className="text-[#db2203]">EXPRESS</span></div>
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
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-none ${a.sev === 'high' ? 'text-[#db2203]' : a.sev === 'medium' ? 'text-[#F2A93B]' : 'text-muted-foreground'}`} />
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
              <DropdownMenuItem onClick={handleLogout} className="text-[#db2203] focus:text-[#db2203]">
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
              syncError ? 'bg-[#FBEAE7] border-danger/30 text-[#db2203]' : 'bg-[#EAF1FC] border-[#2563EB]/20 text-navy'
            }`}>
              {syncError || 'Syncing branch data with backend...'}
            </div>
          )}

          {view === 'overview' && (
            <OverviewView managerProfile={managerProfile} branchDetails={branchDetails} pendingPickups={pendingPickups} pickedUpCount={pickedUpCount}
              outForDelivery={outForDelivery} deliveredCount={deliveredCount} failedDeliveries={failedDeliveries}
              onlineRiders={onlineRiders} busyRiders={busyRiders} switchView={switchView} toast={toast}
              hubAnalytics={hubAnalytics} inboundQueue={inboundQueue} rtoQueue={rtoQueue} hubLoading={hubLoading} />
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
              scanAction={scanAction} setScanAction={setScanAction} lastScan={lastScan}
              inboundQueue={inboundQueue} dispatchQueue={dispatchQueue} manifestHistory={manifestHistory}
              hubLoading={hubLoading} hubError={hubError}
              onScan={handleScan} toast={toast} switchView={switchView}
            />
          )}

          {view === 'manifests' && (
            <ManifestsView
              branchId={branchId} manifestHistory={manifestHistory} schedules={schedules}
              dispatchQueue={dispatchQueue} hubLoading={hubLoading} hubError={hubError} busy={manifestBusy}
              onCreateManifest={handleCreateManifest} onLoadCrate={handleLoadCrate}
              onDepart={handleDepartManifest} onArrive={handleArriveManifest}
            />
          )}

          {view === 'returns' && (
            <ReturnsView
              rtoQueue={rtoQueue} manifestHistory={manifestHistory} hubLoading={hubLoading} busy={manifestBusy}
              onCreateManifest={handleCreateManifest} onLoadCrate={handleLoadCrate}
              onDepart={handleDepartManifest}
            />
          )}

          {view === 'vendors' && (
            <VendorsView
              vendorScores={hubAnalytics?.vendor_scores ?? []} hubLoading={hubLoading}
              token={token} canManage={role === 'admin' || role === 'super_admin'} onChanged={loadHubData}
            />
          )}

          {view === 'warehouse' && <WarehouseView shelfCells={shelfCells} agingParcels={agingParcels} hubLoading={hubLoading} />}

          {view === 'riders' && (
            <RidersView
              riders={riders} onlineRiders={onlineRiders} busyRiders={busyRiders} offlineRiders={offlineRiders}
              staffRiders={staffRiders} canManageWallet={role === 'manager' || role === 'admin' || role === 'super_admin'}
              onLock={handleWalletLock} onUnlock={handleWalletUnlock} onSetLimit={handleWalletSetLimit} toast={toast}
            />
          )}

          {view === 'staff' && <StaffView />}

          {view === 'requests' && <RequestsView />}

          {view === 'servicearea' && <ServiceAreaView />}

          {view === 'map' && (
            <MapView
              riderLocations={riderLocations}
              loading={riderLocationsLoading}
              error={riderLocationsError}
              branchDetails={branchDetails}
            />
          )}

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
function OverviewView({ managerProfile, branchDetails, pendingPickups, pickedUpCount, outForDelivery, deliveredCount, failedDeliveries, onlineRiders, busyRiders, switchView, toast, hubAnalytics, inboundQueue, rtoQueue, hubLoading }: any) {
  const kpis = [
    { icon: <Package className="w-4.5 h-4.5" />, bg: '#2563EB', label: 'Total Shipments Today', num: 412, trend: '+8% vs yesterday', trendColor: '#1E8E5A' },
    { icon: <Clock className="w-4.5 h-4.5" />, bg: '#F2A93B', label: 'Pending Pickups', num: pendingPickups, trend: 'Needs assignment', trendColor: '#B8710A' },
    { icon: <PackageCheck className="w-4.5 h-4.5" />, bg: '#1E8E5A', label: 'Picked Up Parcels', num: pickedUpCount, trend: 'On schedule', trendColor: '#1E8E5A' },
    { icon: <Truck className="w-4.5 h-4.5" />, bg: '#F2A93B', label: 'Out for Delivery', num: outForDelivery, trend: 'Riders en route', trendColor: '#B8710A' },
    { icon: <CheckCircle2 className="w-4.5 h-4.5" />, bg: '#1E8E5A', label: 'Delivered Orders', num: deliveredCount, trend: '91% success rate', trendColor: '#1E8E5A' },
    { icon: <AlertTriangle className="w-4.5 h-4.5" />, bg: '#E6350F', label: 'Failed Deliveries', num: failedDeliveries, trend: 'Review reasons', trendColor: '#E6350F' },
    { icon: <Bike className="w-4.5 h-4.5" />, bg: '#1E8E5A', label: 'Available Riders', num: onlineRiders, trend: 'Ready for dispatch', trendColor: '#1E8E5A' },
    { icon: <Bike className="w-4.5 h-4.5" />, bg: '#F2A93B', label: 'Busy Riders', num: busyRiders, trend: 'On active routes', trendColor: '#B8710A' },
    { icon: <Warehouse className="w-4.5 h-4.5" />, bg: '#1D3C8F', label: 'Warehouse Capacity', num: '72%', trend: 'Approaching limit', trendColor: '#B8710A' },
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

      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base">Hub Snapshot</CardTitle>
          <CardDescription>Parcels moving through this hub's network right now</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <KpiCard icon={<Package className="w-4.5 h-4.5" />} bg="#2563EB" label="Parcels In Today" num={hubLoading ? '—' : hubAnalytics?.snapshot?.parcels_in_today ?? 0} trend="received at hub" trendColor="#2563EB" />
          <KpiCard icon={<Truck className="w-4.5 h-4.5" />} bg="#F2650D" label="Parcels Out Today" num={hubLoading ? '—' : hubAnalytics?.snapshot?.parcels_out_today ?? 0} trend="loaded & departed" trendColor="#C1550C" />
          <KpiCard icon={<Bus className="w-4.5 h-4.5" />} bg="#1D3C8F" label="On Bus" num={hubLoading ? '—' : hubAnalytics?.snapshot?.on_bus ?? 0} trend="in transit right now" trendColor="#1D3C8F" />
          <KpiCard icon={<Clock className="w-4.5 h-4.5" />} bg="#F2A93B" label="Pending" num={hubLoading ? '—' : hubAnalytics?.snapshot?.pending ?? 0} trend="awaiting hub scan" trendColor="#B8710A" />
          <KpiCard icon={<Undo2 className="w-4.5 h-4.5" />} bg="#E6350F" label="RTOs" num={hubLoading ? '—' : hubAnalytics?.snapshot?.rto ?? 0} trend="awaiting return dispatch" trendColor="#E6350F" />
        </div>
      </Card>

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
          <Button variant="ghost" size="sm" className="text-[#db2203] font-bold" onClick={() => switchView('alerts')}>
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
        <Progress value={progressPct} className="h-2 [&>div]:bg-[#db2203]" />
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
                    ? <Button size="sm" variant="outline" className="text-[#db2203]" onClick={() => onQuickAssign(p.id)}>Quick Assign</Button>
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
                    <div className="h-full transition-all" style={{ width: `${d.progress}%`, background: d.status === 'Failed' ? '#E6350F' : '#F2650D' }} />
                  </div>
                </TableCell>
                <TableCell><Pill status={d.status} /></TableCell>
                <TableCell className="text-muted-foreground">{d.proof}</TableCell>
                <TableCell>
                  {d.status === 'Failed'
                    ? <Button size="sm" variant="outline" className="text-[#db2203]" onClick={() => onReschedule(d.id)}>Reschedule</Button>
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
const SCAN_MODES: { value: HubScanAction; label: string; desc: string }[] = [
  { value: 'in', label: 'Scan In', desc: 'received at this hub' },
  { value: 'out', label: 'Scan Out', desc: 'departed this branch (on the bus)' },
  { value: 'arrive', label: 'Scan Arrive', desc: 'arrived at destination hub' },
];

function ParcelOpsView({
  scanInput, setScanInput, scanning, scanAction, setScanAction, lastScan,
  inboundQueue, dispatchQueue, manifestHistory, hubLoading, hubError, onScan, toast, switchView,
}: {
  scanInput: string; setScanInput: (v: string) => void; scanning: boolean;
  scanAction: HubScanAction; setScanAction: (v: HubScanAction) => void; lastScan: HubScanResult | null;
  inboundQueue: HubOrderSummary[]; dispatchQueue: HubOrderSummary[]; manifestHistory: HubManifestSummary[];
  hubLoading: boolean; hubError: string;
  onScan: () => void; toast: (msg: string) => void; switchView: (v: View) => void;
}) {
  const mode = SCAN_MODES.find((m) => m.value === scanAction) || SCAN_MODES[0];
  return (
    <>
      {hubError && <div className="rounded-lg border border-danger/30 bg-[#FBEAE7] px-4 py-3 text-sm text-[#db2203]">{hubError}</div>}

      <Card className="p-5">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-base">Scan Parcel</CardTitle>
          <CardDescription>The hub scanner drives the parcel through the bus network - a scan updates its status (arrived at this hub / in transit / out of this branch)</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {SCAN_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setScanAction(m.value)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  scanAction === m.value ? 'bg-navy text-white border-navy' : 'bg-card border-line text-muted-foreground hover:border-navy/40'
                }`}
              >
                {m.label}
                <span className={`block text-[0.62rem] font-medium ${scanAction === m.value ? 'text-white/70' : 'text-muted-foreground'}`}>{m.desc}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input type="text" placeholder="Enter or scan tracking number…" value={scanInput} onChange={(e) => setScanInput(e.target.value)} className="flex-1" />
            <CameraScanButton onScan={setScanInput} />
            <Button onClick={onScan} variant="navy" disabled={scanning}>{scanning ? 'Scanning…' : `Scan ${mode.label}`}</Button>
            <Button onClick={() => switchView('manifests')} variant="outline">Load onto manifest →</Button>
          </div>
          {lastScan && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-[#EAF7EF] px-4 py-2.5 text-sm">
              <span className="font-mono font-bold text-ink">{lastScan.tracking_number}</span>
              <span className="text-success font-semibold">{lastScan.status.replace(/_/g, ' ')}</span>
              <span className="text-xs text-muted-foreground flex-1 text-right">{lastScan.note}</span>
            </div>
          )}
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
// VIEW: MANIFESTS (create outbound, load crates, depart, receive arrivals)
// ============================================================
function ManifestsView({
  branchId, manifestHistory, schedules, dispatchQueue, hubLoading, hubError, busy,
  onCreateManifest, onLoadCrate, onDepart, onArrive,
}: {
  branchId?: string; manifestHistory: HubManifestSummary[]; schedules: BusSchedule[]; dispatchQueue: HubOrderSummary[];
  hubLoading: boolean; hubError: string; busy: boolean;
  onCreateManifest: (scheduleId: string, coachNumber: string, departureAt?: string) => Promise<string | undefined>;
  onLoadCrate: (manifestId: string, trackingNumber: string, source: HubOrderSummary[], crateLabelPrefix?: string) => void;
  onDepart: (manifestId: string) => void;
  onArrive: (manifestId: string, scannedItemIds: string[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [scheduleId, setScheduleId] = useState('');
  const [coachNumber, setCoachNumber] = useState('');
  const [departureAt, setDepartureAt] = useState('');
  const [crateInputs, setCrateInputs] = useState<Record<string, string>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, Set<string>>>({});

  const outboundSchedules = schedules.filter((s) => s.origin_branch_id === branchId);
  const outbound = manifestHistory.filter((m) => m.direction === 'outbound');
  const preparing = outbound.filter((m) => m.status === 'in_preparation');
  const departed = outbound.filter((m) => m.status !== 'in_preparation');
  const arrivals = manifestHistory.filter((m) => m.direction === 'inbound' && m.status === 'in_transit');

  function toggleItem(manifestId: string, itemId: string) {
    setCheckedItems((prev) => {
      const set = new Set(prev[manifestId] ?? []);
      set.has(itemId) ? set.delete(itemId) : set.add(itemId);
      return { ...prev, [manifestId]: set };
    });
  }

  return (
    <>
      {hubError && <div className="rounded-lg border border-danger/30 bg-[#FBEAE7] px-4 py-3 text-sm text-[#db2203]">{hubError}</div>}

      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <div>
            <CardTitle className="text-base">Outbound Manifests</CardTitle>
            <CardDescription>Create a manifest, load crates by scan, then depart to lock it</CardDescription>
          </div>
          {!showForm && <Button size="sm" variant="navy" onClick={() => setShowForm(true)}>New manifest</Button>}
        </div>

        {showForm && (
          <div className="mt-4 grid gap-3 md:grid-cols-3 border-t border-line pt-4">
            <select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm md:col-span-2">
              <option value="">Departure corridor (optional)</option>
              {outboundSchedules.map((s) => (
                <option key={s.id} value={s.id}>{s.origin_city} → {s.destination_city} · {s.operator_name || 'no operator'}</option>
              ))}
            </select>
            <Input type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)} placeholder="Departure time" />
            <Input value={coachNumber} onChange={(e) => setCoachNumber(e.target.value)} placeholder="Coach / bus number" className="md:col-span-2" />
            <div className="flex gap-2 md:col-span-3">
              <Button size="sm" disabled={busy} onClick={() => { onCreateManifest(scheduleId, coachNumber, departureAt || undefined); setShowForm(false); setScheduleId(''); setCoachNumber(''); setDepartureAt(''); }}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
            {outboundSchedules.length === 0 && (
              <p className="md:col-span-3 text-xs text-muted-foreground">No departure corridors are set up with this branch as origin yet - you can still create a manifest without one and fill in the coach number manually.</p>
            )}
          </div>
        )}
      </Card>

      {hubLoading ? (
        <Card className="p-6"><p className="text-sm text-muted-foreground">Loading manifests…</p></Card>
      ) : preparing.length === 0 ? (
        <Card className="p-6"><p className="text-sm text-muted-foreground">No manifest is being prepared at this hub right now.</p></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {preparing.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-ink">{m.manifest_number || m.id.slice(0, 8)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.origin_city || '—'} → {m.destination_city || '—'} · {m.operator_name || 'no operator'} · coach {m.coach_number || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill status={m.status} />
                  <Button size="sm" variant="outline" onClick={() => window.open(`/branch/print/manifest/${m.id}`, '_blank')}>
                    <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
                  </Button>
                  <Button size="sm" disabled={busy || m.items.length === 0} onClick={() => onDepart(m.id)}>Depart ({m.items.length})</Button>
                </div>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <Input
                  value={crateInputs[m.id] || ''}
                  onChange={(e) => setCrateInputs({ ...crateInputs, [m.id]: e.target.value })}
                  placeholder="Scan or enter tracking number to load…"
                  className="flex-1"
                />
                <CameraScanButton label="Scan" onScan={(v) => onLoadCrate(m.id, v, dispatchQueue)} />
                <Button
                  type="button" variant="navy" disabled={busy}
                  onClick={() => { onLoadCrate(m.id, crateInputs[m.id] || '', dispatchQueue); setCrateInputs({ ...crateInputs, [m.id]: '' }); }}
                >
                  Load crate
                </Button>
              </div>
              <ManifestItemsTable items={m.items} />
            </Card>
          ))}
        </div>
      )}

      <Card className="p-5">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="text-base">Arrivals Expected at This Hub</CardTitle>
          <CardDescription>Scan crates off the bus as they're physically unloaded, then mark the manifest arrived</CardDescription>
        </CardHeader>
        {arrivals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing in transit to this hub right now.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {arrivals.map((m) => {
              const checked = checkedItems[m.id] ?? new Set<string>();
              return (
                <div key={m.id} className="rounded-xl border border-line p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-ink">{m.manifest_number || m.id.slice(0, 8)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{m.origin_city} → {m.destination_city} · {m.operator_name || 'no operator'}</p>
                    </div>
                    <Button size="sm" disabled={busy} onClick={() => onArrive(m.id, Array.from(checked))}>
                      Mark arrived ({checked.size}/{m.items.length})
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {m.items.map((it) => (
                      <label key={it.id} className="flex items-center gap-2 text-sm text-ink">
                        <input type="checkbox" checked={checked.has(it.id)} onChange={() => toggleItem(m.id, it.id)} />
                        <span className="font-mono text-xs">{it.tracking_number || it.crate_label || it.id.slice(0, 8)}</span>
                      </label>
                    ))}
                    {m.items.length === 0 && <p className="text-xs text-muted-foreground">No crates recorded on this manifest.</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {departed.length > 0 && (
        <Card className="p-5">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="text-base">Departed / Arrived History</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30"><TableHead>Manifest</TableHead><TableHead>Route</TableHead><TableHead>Items</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {departed.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.manifest_number || m.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.origin_city} → {m.destination_city}</TableCell>
                  <TableCell>{m.item_count}</TableCell>
                  <TableCell><Pill status={m.status} /></TableCell>
                  <TableCell className="text-right">
                    <button onClick={() => window.open(`/branch/print/manifest/${m.id}`, '_blank')} title="Print manifest" className="p-1.5 rounded-md border border-line text-muted-foreground hover:text-navy hover:border-navy transition-colors">
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}

function ManifestItemsTable({ items }: { items: HubManifestItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30"><TableHead>Crate</TableHead><TableHead>Tracking</TableHead><TableHead>Scan</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i) => (
          <TableRow key={i.id}>
            <TableCell className="font-mono text-xs">{i.crate_label || '—'}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{i.tracking_number || '—'}</TableCell>
            <TableCell><Pill status={i.scan_status || 'loaded'} /></TableCell>
          </TableRow>
        ))}
        {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No crates loaded yet.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

// ============================================================
// VIEW: RETURNS / RTO
// ============================================================
function ReturnsView({
  rtoQueue, manifestHistory, hubLoading, busy, onCreateManifest, onLoadCrate, onDepart,
}: {
  rtoQueue: HubOrderSummary[]; manifestHistory: HubManifestSummary[]; hubLoading: boolean; busy: boolean;
  onCreateManifest: (scheduleId: string, coachNumber: string, departureAt?: string) => Promise<string | undefined>;
  onLoadCrate: (manifestId: string, trackingNumber: string, source: HubOrderSummary[], crateLabelPrefix?: string) => void;
  onDepart: (manifestId: string) => void;
}) {
  const [selectedManifest, setSelectedManifest] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [coachNumber, setCoachNumber] = useState('');

  // A "return batch" is just a manifest whose crates carry an RTO- prefix -
  // the manifest system already gives us route, bus, lock-on-departure and
  // an audit trail, so returns don't need a parallel data model.
  const returnBatches = manifestHistory.filter((m) => m.direction === 'outbound' && m.items.some((i) => i.crate_label?.startsWith('RTO-')));
  const openBatches = returnBatches.filter((m) => m.status === 'in_preparation');

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Undo2 className="w-4.5 h-4.5" />} bg="#E6350F" label="Awaiting Return Dispatch" num={rtoQueue.length} trend="3-attempt policy exhausted" trendColor="#E6350F" />
        <KpiCard icon={<Bus className="w-4.5 h-4.5" />} bg="#1D3C8F" label="Open Return Batches" num={openBatches.length} trend="in preparation" trendColor="#1D3C8F" />
        <KpiCard icon={<CheckCircle2 className="w-4.5 h-4.5" />} bg="#1E8E5A" label="Return Batches Dispatched" num={returnBatches.length - openBatches.length} trend="on the way back" trendColor="#1E8E5A" />
      </div>

      <Card className="p-5">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="text-base">RTO Queue</CardTitle>
          <CardDescription>Failed delivery, 3 attempts exhausted - waiting to be batched onto a return bus</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30"><TableHead>Tracking ID</TableHead><TableHead>Origin</TableHead><TableHead>Status</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rtoQueue.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.tracking_number}</TableCell>
                <TableCell>{r.dropoff_city || '—'}</TableCell>
                <TableCell><Pill status={r.status} /></TableCell>
              </TableRow>
            ))}
            {!hubLoading && rtoQueue.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No parcels awaiting return right now.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-5">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="text-base">Return Batch Dispatch</CardTitle>
          <CardDescription>Start a batch (or pick an open one), scan RTO parcels into it, then dispatch - each parcel gets an RTO- crate label as its batch ID</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <select value={selectedManifest} onChange={(e) => setSelectedManifest(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm md:col-span-2">
            <option value="">Select an open return batch…</option>
            {openBatches.map((m) => <option key={m.id} value={m.id}>{m.manifest_number || m.id.slice(0, 8)} · {m.item_count} crate(s)</option>)}
          </select>
          <div className="flex gap-2">
            <Input value={coachNumber} onChange={(e) => setCoachNumber(e.target.value)} placeholder="Coach number" className="flex-1" />
            <Button
              type="button" variant="outline" disabled={busy}
              onClick={async () => {
                const id = await onCreateManifest('', coachNumber);
                if (id) setSelectedManifest(id);
                setCoachNumber('');
              }}
            >
              New batch
            </Button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Input value={scanInput} onChange={(e) => setScanInput(e.target.value)} placeholder="Scan or enter RTO tracking number…" className="flex-1" />
          <CameraScanButton label="Scan" onScan={(v) => selectedManifest && onLoadCrate(selectedManifest, v, rtoQueue, 'RTO-')} />
          <Button
            variant="navy" disabled={busy || !selectedManifest}
            onClick={() => { onLoadCrate(selectedManifest, scanInput, rtoQueue, 'RTO-'); setScanInput(''); }}
          >
            Add to batch
          </Button>
        </div>
        {!selectedManifest && <p className="text-xs text-muted-foreground mt-2">Start a new batch or pick an open one above before scanning parcels into it.</p>}

        {openBatches.length > 0 && (
          <div className="mt-5 flex flex-col gap-4">
            {openBatches.map((m) => (
              <div key={m.id} className="rounded-xl border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-ink text-sm">{m.manifest_number || m.id.slice(0, 8)} <span className="font-normal text-muted-foreground">· coach {m.coach_number || '—'}</span></p>
                  <Button size="sm" disabled={busy || m.items.length === 0} onClick={() => onDepart(m.id)}>Dispatch batch ({m.items.length})</Button>
                </div>
                <ManifestItemsTable items={m.items} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ============================================================
// VIEW: BUS VENDORS
// ============================================================
function VendorsView({
  vendorScores, hubLoading, token, canManage, onChanged,
}: {
  vendorScores: VendorScore[]; hubLoading: boolean;
  token: string | null; canManage: boolean; onChanged: () => void;
}) {
  const [operators, setOperators] = useState<BusOperator[]>([]);
  const [form, setForm] = useState({ name: '', city: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function loadOperators() {
    if (!token) return;
    listBusOperators(token).then(setOperators).catch(() => {});
  }

  useEffect(() => { loadOperators(); }, [token]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await createBusOperator({ name: form.name, city: form.city || null, contact_phone: form.phone || null, status: 'active' }, token);
      setForm({ name: '', city: '', phone: '' });
      setNotice('Operator added.');
      loadOperators();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add operator.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(o: BusOperator) {
    if (!token) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await deactivateBusOperator(o.id, token);
      setNotice(`${o.name} deactivated.`);
      loadOperators();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not deactivate operator.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {canManage && (
        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <CardHeader className="p-0 mb-3">
              <CardTitle className="text-base">Add bus operator</CardTitle>
              <CardDescription>Register an inter-city bus vendor for this hub's corridors</CardDescription>
            </CardHeader>
            <form onSubmit={handleAdd} className="flex flex-col gap-2.5">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Operator name (e.g. Faisal Movers)" />
              <div className="grid sm:grid-cols-2 gap-2.5">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Contact phone" />
              </div>
              {error && <p className="text-sm text-[#db2203]">{error}</p>}
              {notice && <p className="text-sm text-success">{notice}</p>}
              <div>
                <Button type="submit" variant="navy" disabled={busy}>{busy ? 'Saving…' : 'Add operator'}</Button>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <CardHeader className="p-0 mb-3">
              <CardTitle className="text-base">Operators</CardTitle>
              <CardDescription>Deactivate an operator to stop it appearing on new manifests</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30"><TableHead>Name</TableHead><TableHead>City</TableHead><TableHead>Status</TableHead><TableHead className="text-right"></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-semibold text-ink">{o.name}</TableCell>
                    <TableCell className="text-muted-foreground">{o.city || '—'}</TableCell>
                    <TableCell><Pill status={o.status} /></TableCell>
                    <TableCell className="text-right">
                      {o.status !== 'inactive' && (
                        <Button size="sm" variant="outline" className="text-[#db2203]" disabled={busy} onClick={() => handleRemove(o)}>Deactivate</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {operators.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No operators yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      <Card className="p-5">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="text-base">Bus Operator On-Time Scores</CardTitle>
          <CardDescription>Departures within 15 minutes of schedule, through this hub</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30"><TableHead>Operator</TableHead><TableHead>Manifests</TableHead><TableHead>On-Time</TableHead><TableHead>Score</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {vendorScores.map((v) => (
              <TableRow key={v.operator_id}>
                <TableCell className="font-semibold text-ink">{v.operator_name}</TableCell>
                <TableCell>{v.total}</TableCell>
                <TableCell>{v.on_time}</TableCell>
                <TableCell><Badge variant={v.on_time_pct >= 90 ? 'success' : v.on_time_pct >= 70 ? 'warning' : 'danger'}>{v.on_time_pct}%</Badge></TableCell>
              </TableRow>
            ))}
            {!hubLoading && vendorScores.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No dispatched manifests yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ============================================================
// VIEW: WAREHOUSE
// ============================================================
function WarehouseView({ shelfCells, agingParcels, hubLoading }: { shelfCells: ('low' | 'mid' | 'high')[]; agingParcels: HubAgingOrder[]; hubLoading: boolean }) {
  const shelfColor = { low: '#EAF7EF', mid: '#FDF1DD', high: '#FBEAE7' };
  const shelfBorder = { low: '#1E8E5A', mid: '#F2A93B', high: '#E6350F' };
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
function RidersView({ riders, onlineRiders, busyRiders, offlineRiders, staffRiders, canManageWallet, onLock, onUnlock, onSetLimit, toast }: any) {
  const walletRows = staffRiders || [];
  return (
    <>
      <StatStrip items={[
        { num: riders.length, label: 'Total Riders Assigned' },
        { num: onlineRiders, label: 'Online / Available' },
        { num: busyRiders, label: 'On Delivery' },
        { num: offlineRiders, label: 'Offline' },
      ]} />

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <CardHeader className="p-0 mb-1">
              <CardTitle className="text-base">COD Wallet Controls</CardTitle>
              <CardDescription>Cash-in-hand per rider - lock holds their wallet, unlock clears the cash, and the limit sets the auto-lock ceiling</CardDescription>
            </CardHeader>
          </div>
          {!canManageWallet && <Badge variant="secondary">Managers & admins can manage wallets</Badge>}
        </div>
        {walletRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No riders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rider</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cash in hand</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Limit</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {walletRows.map((r: StaffRider) => {
                  const pct = r.wallet_limit ? Math.min(100, (r.cod_cash_held / r.wallet_limit) * 100) : 0;
                  return (
                    <tr key={r.rider_id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{r.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.phone}</div>
                      </td>
                      <td className="px-4 py-3 w-56">
                        <div className="text-xs font-semibold text-ink mb-1">Rs {r.cod_cash_held.toLocaleString()} / {r.wallet_limit.toLocaleString()}</div>
                        <div className="h-1.5 rounded-full bg-line overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.cod_wallet_locked ? '#E6350F' : pct >= 70 ? '#F2A93B' : '#1E8E5A' }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {canManageWallet ? (
                          <Button size="sm" variant="outline" onClick={() => onSetLimit(r.rider_id, r.wallet_limit)}>
                            Rs {r.wallet_limit.toLocaleString()} · Edit
                          </Button>
                        ) : (
                          `Rs ${r.wallet_limit.toLocaleString()}`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.cod_wallet_locked ? <Badge variant="danger">Locked</Badge> : pct >= 70 ? <Badge variant="warning">Near limit</Badge> : <Badge variant="success">OK</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {canManageWallet && (
                          <div className="flex gap-2 justify-end">
                            {r.cod_wallet_locked ? (
                              <Button size="sm" variant="outline" className="text-success" onClick={() => onUnlock(r.rider_id)}>Unlock (cash deposited)</Button>
                            ) : (
                              <Button size="sm" variant="outline" className="text-[#db2203]" onClick={() => onLock(r.rider_id)}>Lock</Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
                  <div className="col-span-2"><div className="text-muted-foreground">Performance</div><div className="text-[#db2203]">{'★'.repeat(Math.round(r.score))}{'☆'.repeat(5 - Math.round(r.score))}</div></div>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-xs text-muted-foreground">{r.deliveries} deliveries today</span>
                  <Button size="sm" variant="outline" className="text-[#db2203]" onClick={() => toast(`Shipment assignment started for ${r.name}.`)}>Assign</Button>
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
function MapView({ riderLocations, loading, error, branchDetails }: {
  riderLocations: RiderLocation[]; loading: boolean; error: string; branchDetails?: BranchDetails;
}) {
  const branchLat = branchDetails?.latitude ? parseFloat(branchDetails.latitude) : NaN;
  const branchLng = branchDetails?.longitude ? parseFloat(branchDetails.longitude) : NaN;
  const branchCenter: [number, number] | undefined =
    !isNaN(branchLat) && !isNaN(branchLng) ? [branchLat, branchLng] : undefined;

  const availableCount = riderLocations.filter((r) => r.is_available).length;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <CardTitle className="text-base">Live Operations Map</CardTitle>
          <CardDescription>Real-time rider positions across the branch coverage area</CardDescription>
        </div>
        <Badge variant={riderLocations.length ? 'success' : 'warning'}>
          {loading && riderLocations.length === 0 ? 'Loading…' : `${riderLocations.length} rider${riderLocations.length === 1 ? '' : 's'} on map`}
        </Badge>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-[#FBEAE7] border border-danger/30 text-[#db2203] text-xs px-3 py-2">
          {error}
        </div>
      )}

      <div className="w-full h-[520px] rounded-xl overflow-hidden border border-line">
        <RiderMap riders={riderLocations} center={branchCenter} />
      </div>

      <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-[#2563EB]" />Rider marker (tap for details)</span>
        <span>{availableCount} available / {riderLocations.length - availableCount} unavailable</span>
        <span>Refreshes every 12s while this tab is open</span>
      </div>
    </Card>
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
                <div className="h-1.5 bg-line rounded-full overflow-hidden mb-1"><div className="h-full bg-[#db2203]" style={{ width: `${c.branch}%` }} /></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden"><div className="h-full bg-[#B7BEC9]" style={{ width: `${c.network}%` }} /></div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground mt-1"><span className="text-[#db2203] font-bold">■</span> This branch &nbsp; <span className="text-[#B7BEC9] font-bold">■</span> Network average</div>
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
  const border = alert.sev === 'high' ? '#E6350F' : alert.sev === 'medium' ? '#F2A93B' : '#B7BEC9';
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
