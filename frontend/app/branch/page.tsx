'use client';

import { useEffect, useMemo, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/context/AuthContext';
import {
  ApiError,
  listAllOrders,
  listRiders,
  listStaffOrders,
  listStaffRiders,
  Order as ApiOrder,
  StaffRider,
  AdminRider,
  RiderCard,
  ManagerProfile,
  getManagerProfile,
  getBranchDetails,
  BranchDetails,
} from '@/lib/api';
import {
  INITIAL_RIDERS, INITIAL_PICKUPS, INITIAL_DELIVERIES, RECEIVING_QUEUE, DISPATCH_QUEUE,
  TRANSFER_HISTORY, AGING_PARCELS, STAFF, ZONES, ACTIVITY, ALERTS,
  Pickup, Delivery, ScanLogEntry,
} from './data';
import { Pill, AvatarChip, KpiCard, StatStrip, Toasts } from './components';
import { request } from 'http';

type View = 'overview' | 'pickups' | 'deliveries' | 'parcelops' | 'warehouse' | 'riders' | 'staff' | 'servicearea' | 'map' | 'reports' | 'alerts';

const NAV_SECTIONS: { label: string; items: { view: View; label: string; icon: string }[] }[] = [
  { label: 'Operations', items: [
    { view: 'overview', label: 'Overview', icon: 'grid' },
    { view: 'pickups', label: 'Pickups', icon: 'pickup' },
    { view: 'deliveries', label: 'Deliveries', icon: 'truck' },
    { view: 'parcelops', label: 'Parcel Operations', icon: 'box' },
    { view: 'warehouse', label: 'Warehouse', icon: 'warehouse' },
  ]},
  { label: 'Team', items: [
    { view: 'riders', label: 'Riders', icon: 'riders' },
    { view: 'staff', label: 'Staff', icon: 'staff' },
  ]},
  { label: 'Coverage', items: [
    { view: 'servicearea', label: 'Service Area', icon: 'pin' },
    { view: 'map', label: 'Live Map', icon: 'map' },
  ]},
  { label: 'Insights', items: [
    { view: 'reports', label: 'Reports', icon: 'reports' },
    { view: 'alerts', label: 'Alerts', icon: 'alert' },
  ]},
];

const PAGE_META: Record<View, { title: string; sub: string }> = {
  overview: { title: 'Overview', sub: 'Lahore Central Branch · live operational snapshot' },
  pickups: { title: 'Pickup Management', sub: "Today's pickup requests and rider assignment" },
  deliveries: { title: 'Delivery Management', sub: 'Track every order from ready to delivered' },
  parcelops: { title: 'Parcel Operations', sub: 'Scanning, sorting and inter-branch transfers' },
  warehouse: { title: 'Warehouse Management', sub: 'Storage capacity and inventory movement' },
  riders: { title: 'Rider Management', sub: 'Availability, location and performance' },
  staff: { title: 'Branch Staff', sub: 'Roles, attendance and permissions' },
  servicearea: { title: 'Service Area Management', sub: 'Zones, postal codes and delivery capabilities' },
  map: { title: 'Live Operations Map', sub: 'Real-time positions across the branch coverage area' },
  reports: { title: 'Reports & Analytics', sub: 'Performance trends and branch comparisons' },
  alerts: { title: 'Alerts & Notifications', sub: 'Everything flagged for review' },
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

// function mapApiRiders(apiRiders: StaffRider[]) {
//   if (apiRiders.length === 0) return [];

//   return apiRiders.map((rider) => ({
//     name: rider.full_name,
//     vehicle: `${rider.vehicle_type || 'vehicle'} · ${rider.phone}`,
//     status: rider.is_available ? 'online' as const : 'offline' as const,
//     score: rider.rating || 5,
//     success: Math.round((rider.rating || 5) * 20),
//     deliveries: 0,
//     gps: rider.is_available ? 'Available for assignment' : 'Unavailable',
//   }));
// }

// function mapApiRiders(apiRiders: AdminRider[]): RiderCard[] {
//     return apiRiders.map((rider) => ({
//         name: rider.full_name,
//         vehicle: `${rider.vehicle_type} · ${rider.phone}`,
//         status: rider.is_available ? "online" : "offline",
//         score: rider.rating ?? 5,
//         success: Math.round((rider.rating ?? 5) * 20),
//         deliveries: rider.completed_deliveries ?? 0,
//         gps: rider.current_location ?? "Unknown",
//     }));
// }


function mapApiRiders(apiRiders: StaffRider[]): RiderCard[] {
    return apiRiders.map((rider) => ({
        name: rider.full_name,
        vehicle: `${rider.vehicle_type} · ${rider.phone}`,
        status: rider.is_available ? "online" : "offline",
        score: rider.rating ?? 5,
        success: Math.round((rider.rating ?? 5) * 20),
        deliveries: rider.rating ?? 0,
        gps: rider.is_available
            ? "Available for assignment"
            : "Unavailable",
    }));
}

export default function BranchDashboardPage() {
  return (
    // Branch console needs admin oversight too, not just the branch's own staff
    <RoleGuard allowedRoles={['staff', 'admin', 'super_admin']}>
      <BranchDashboardContent />
    </RoleGuard>
  );
}


function BranchDashboardContent() {
  const { token, role } = useAuth();

  // const [profile, setProfile] = useState<ManagerProfile>();

  const [view, setView] = useState<View>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  // const [riders, setRiders] = useState(INITIAL_RIDERS);
  // const [riders, setRiders] = useState<AdminRider[]>([]);
  const [riders, setRiders] = useState<RiderCard[]>([]);

  const [managerProfile, setManagerProfile] = useState<ManagerProfile>();

  const [pickups, setPickups] = useState<Pickup[]>(INITIAL_PICKUPS);
  const [deliveries, setDeliveries] = useState<Delivery[]>(INITIAL_DELIVERIES);
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  const [pickupSearch, setPickupSearch] = useState('');
  const [pickupStatusFilter, setPickupStatusFilter] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('');

  const [branchDetails, setBranchDetails] = useState<BranchDetails>();

  // Random shelf occupancy visualization - generated client-side only after
  // mount, never during render, so server and client HTML always match on
  // first paint (Math.random() during render causes hydration mismatches)
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

  function loadBranchDetails(){

    if(!token){
      return;
    }

    getBranchDetails(token).then(setBranchDetails).catch((error) => {
      setSyncError(error instanceof ApiError ? error.message : "could not sync branch details")
    }).finally(() => setSyncing(false));
  }

  function loadManagerProfile(){

    if(!token){
      return;
    }

    getManagerProfile(token).then(setManagerProfile).catch((err) => {
      setSyncError(err instanceof ApiError ? err.message : "could not sync manager profile")
    }).finally(() => setSyncing(false))
  }

  useEffect(() => {
    loadManagerProfile();
    loadBranchDetails();

  }, [token])
  function toast(msg: string) {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }

  function switchView(v: View) {
    setView(v);
    setSidebarOpen(false);
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
    setScanLog((prev) => [{ id: val, type, time: 'Just now' }, ...prev]);
    setScanInput('');
    toast(`${type} scan recorded for ${val}`);
  }

  return (
    <div className="min-h-screen flex bg-page">
      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-navy text-white flex flex-col p-4 gap-1 overflow-y-auto transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-2.5 mb-6 px-1">
          <svg width="30" height="30" viewBox="0 0 40 40" fill="none">
            <path d="M2 20 L24 20 L18 12 L34 20 L18 28 L24 20" fill="none" stroke="#F2701A" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div>
            <div className="font-display text-lg font-extrabold leading-none">FAST<span className="text-orange">EX</span></div>
            <div className="text-[0.6rem] tracking-[0.2em] text-white/50 font-semibold mt-0.5">BRANCH CONSOLE</div>
          </div>
        </div>

        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-3">
            <div className="text-[0.68rem] font-bold uppercase tracking-wide text-white/40 px-2 mb-1.5 mt-3">{section.label}</div>
            {section.items.map((item) => (
              <button
                key={item.view}
                onClick={() => switchView(item.view)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  view === item.view ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <NavIcon name={item.icon} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.view === 'pickups' && pendingPickups > 0 && <NavBadge n={pendingPickups} />}
                {item.view === 'deliveries' && outForDelivery > 0 && <NavBadge n={outForDelivery} />}
                {item.view === 'riders' && <NavBadge n={onlineRiders + busyRiders} />}
                {item.view === 'alerts' && <NavBadge n={ALERTS.length} danger />}
              </button>
            ))}
          </div>
        ))}

        <div className="mt-auto pt-4 border-t border-white/10 text-xs text-white/50">
          {/* Lahore Central Branch */}
          {branchDetails?.address}
          <div className="text-white/70 font-semibold mt-0.5">LHE-CTR-01 · Punjab Region</div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* MAIN */}
      <div className="flex-1 min-w-0">
        <div className="bg-white border-b border-line px-5 md:px-8 py-4 flex items-center gap-4 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen((s) => !s)} className="lg:hidden p-2 text-ink" aria-label="Toggle menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-bold text-ink truncate">{PAGE_META[view].title}</h1>
            <div className="text-xs text-muted truncate">{PAGE_META[view].sub}</div>
          </div>
          <button onClick={() => switchView('alerts')} className="relative p-2 text-ink hover:bg-page rounded-lg" title="Alerts">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            {ALERTS.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-danger text-white text-[0.6rem] font-bold flex items-center justify-center">{ALERTS.length}</span>
            )}
          </button>
          <button onClick={() => switchView('pickups')} className="hidden sm:flex items-center gap-1.5 bg-orange hover:bg-orange-light text-white font-bold text-sm px-4 py-2.5 rounded-[10px] transition-colors whitespace-nowrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            New Pickup
          </button>
        </div>

        <div className="p-5 md:p-8 flex flex-col gap-6">
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
            <ParcelOpsView scanInput={scanInput} setScanInput={setScanInput} scanLog={scanLog}
              onScan={handleScan} toast={toast} />
          )}

          {view === 'warehouse' && <WarehouseView shelfCells={shelfCells} />}

          {view === 'riders' && <RidersView riders={riders} onlineRiders={onlineRiders} busyRiders={busyRiders} offlineRiders={offlineRiders} toast={toast} />}

          {view === 'staff' && <StaffView />}

          {view === 'servicearea' && <ServiceAreaView />}

          {view === 'map' && <MapView riders={riders} />}

          {view === 'reports' && <ReportsView riders={riders} />}

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
function OverviewView({managerProfile, branchDetails, pendingPickups, pickedUpCount, outForDelivery, deliveredCount, failedDeliveries, onlineRiders, busyRiders, switchView, toast }: any) {
  const kpis = [
    { icon: 'box', bg: '#2563EB', label: 'Total Shipments Today', num: 412, trend: '+8% vs yesterday', trendColor: '#1E8E5A' },
    { icon: 'clock', bg: '#F2A93B', label: 'Pending Pickups', num: pendingPickups, trend: 'Needs assignment', trendColor: '#B8710A' },
    { icon: 'check', bg: '#1E8E5A', label: 'Picked Up Parcels', num: pickedUpCount, trend: 'On schedule', trendColor: '#1E8E5A' },
    { icon: 'truck', bg: '#F2A93B', label: 'Out for Delivery', num: outForDelivery, trend: 'Riders en route', trendColor: '#B8710A' },
    { icon: 'check', bg: '#1E8E5A', label: 'Delivered Orders', num: deliveredCount, trend: '91% success rate', trendColor: '#1E8E5A' },
    { icon: 'alert', bg: '#D8432C', label: 'Failed Deliveries', num: failedDeliveries, trend: 'Review reasons', trendColor: '#D8432C' },
    { icon: 'riders', bg: '#1E8E5A', label: 'Available Riders', num: onlineRiders, trend: 'Ready for dispatch', trendColor: '#1E8E5A' },
    { icon: 'riders', bg: '#F2A93B', label: 'Busy Riders', num: busyRiders, trend: 'On active routes', trendColor: '#B8710A' },
    { icon: 'warehouse', bg: '#173868', label: 'Warehouse Capacity', num: '72%', trend: 'Approaching limit', trendColor: '#B8710A' },
  ];

  const quickActions = [
    { icon: 'clock', label: 'Create Pickup Request', msg: 'Pickup request created.' },
    { icon: 'riders', label: 'Assign Rider', msg: 'Rider assignment panel opened.' },
    { icon: 'box', label: 'Scan Parcel', goto: 'parcelops' },
    { icon: 'truck', label: 'Dispatch Shipment', msg: 'Shipment queued for dispatch.' },
    { icon: 'check', label: 'Add Staff', goto: 'staff' },
    { icon: 'reports', label: 'Generate Report', goto: 'reports' },
  ];

  return (
    <>
      <div className="bg-white border border-line rounded-2xl p-6 flex flex-col lg:flex-row gap-6 justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h2 className="font-display text-xl font-bold text-ink">{branchDetails?.address}</h2>
            <Pill status="green" label="● Active" />
            <Pill status="blue" label="Regional Hub" />
          </div>
          <div className="text-xs text-muted mb-2">Branch Code: LHE-CTR-01</div>
          <p className="text-sm text-ink max-w-xl leading-relaxed">
            12-B, Gulberg III, Main Boulevard, Lahore, Punjab, Pakistan — serving Lahore metro and surrounding districts.
          </p>
          <a href="https://www.google.com/maps/search/?api=1&query=12-B%20Gulberg%20III%20Main%20Boulevard%20Lahore%20Pakistan" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-navy text-white text-xs font-bold px-3 py-2 rounded-lg mt-3 no-underline">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
            Open in Google Maps
          </a>
          <div className="grid sm:grid-cols-3 gap-4 mt-5">
            <div><div className="text-[0.68rem] text-muted font-semibold uppercase">Working Hours</div><div className="text-sm text-ink mt-0.5">Mon–Sat · 8AM–10PM</div></div>
            <div><div className="text-[0.68rem] text-muted font-semibold uppercase">Branch Type</div><div className="text-sm text-ink mt-0.5">Regional Hub</div></div>
            <div><div className="text-[0.68rem] text-muted font-semibold uppercase">Today's Status</div><div className="text-sm text-ink mt-0.5">Operating normally</div></div>
          </div>
        </div>
        <div className="lg:w-64 flex-none bg-page rounded-xl p-4">
          <div className="text-xs font-bold text-muted uppercase mb-2">Branch Manager</div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center font-bold text-sm flex-none">HR</div>
            <div>
              {/* <div className="font-bold text-sm text-ink">{managerProfile.manager_id}</div> */}
              {/* <div className="text-xs text-muted">+92 300 1234567</div> */}
              <div className="font-bold text-sm text-ink">{managerProfile?.full_name ?? 'Branch Manager'}</div>
              <div className="text-xs text-muted">{managerProfile?.phone ?? '—'}</div>
            </div>
          </div>
          <p className="text-xs text-muted mt-3 leading-relaxed">On-site since 6:45 AM. Reachable on radio channel 3 for escalations.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map(({ icon, ...k }) => <KpiCard key={k.label} icon={<NavIcon name={icon} />} {...k} />)}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Recent Activity</h2>
          <p className="text-xs text-muted mb-4">Real-time events across the branch</p>
          <div className="flex flex-col gap-3">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-none text-white" style={{ background: a.color }}>
                  <NavIcon name={a.icon} size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink">{a.text}</div>
                  <div className="text-xs text-muted mt-0.5">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Quick Actions</h2>
          <p className="text-xs text-muted mb-4">Common branch tasks</p>
          <div className="grid grid-cols-2 gap-2.5">
            {quickActions.map((q) => (
              <button key={q.label}
                onClick={() => { if (q.msg) toast(q.msg); if (q.goto) switchView(q.goto); }}
                className="flex flex-col items-center gap-2 border border-line rounded-xl p-4 text-xs font-semibold text-ink hover:border-orange hover:bg-page transition-colors text-center"
              >
                <NavIcon name={q.icon} size={18} color="#0F2648" />
                {q.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-bold text-base">Priority Alerts</h2>
            <p className="text-xs text-muted">Needs branch manager attention</p>
          </div>
          <button onClick={() => switchView('alerts')} className="text-xs font-bold text-orange">View all →</button>
        </div>
        <div className="flex flex-col gap-2.5">
          {ALERTS.slice(0, 3).map((a, i) => <AlertCard key={i} alert={a} />)}
        </div>
      </section>
    </>
  );
}

// ============================================================
// VIEW: PICKUPS
// ============================================================
function PickupsView({ pickups, total, pending, assigned, done, failed, progressPct, search, setSearch, statusFilter, setStatusFilter, onQuickAssign }: any) {
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <StatStrip items={[
        { num: total, label: "Today's Requests" },
        { num: pending, label: 'Pending Assignment' },
        { num: assigned, label: 'Rider Assigned' },
        { num: done, label: 'Picked Up' },
        { num: failed, label: 'Failed Attempts' },
      ]} />

      <div className="mt-4 mb-4">
        <div className="text-xs font-semibold text-muted mb-1.5">Pickup completion today</div>
        <div className="h-2 bg-line rounded-full overflow-hidden">
          <div className="h-full bg-orange transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input type="text" placeholder="Search customer or zone…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm py-2.5 pl-9 pr-3 rounded-lg border border-line bg-page outline-none focus:border-orange" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm py-2.5 px-3 rounded-lg border border-line bg-page outline-none">
          <option value="">Any status</option>
          <option>Pending</option><option>Assigned</option><option>Picked Up</option><option>Failed</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted text-xs">
              <th className="py-2.5 pr-4">Pickup ID</th><th className="py-2.5 pr-4">Customer / Location</th>
              <th className="py-2.5 pr-4">Time Slot</th><th className="py-2.5 pr-4">Assigned Rider</th>
              <th className="py-2.5 pr-4">Rider Status</th><th className="py-2.5 pr-4">Status</th><th className="py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {pickups.map((p: Pickup) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="py-3 pr-4 font-mono text-xs text-ink">{p.id}</td>
                <td className="py-3 pr-4">{p.customer}<div className="text-xs text-muted">{p.zone}</div></td>
                <td className="py-3 pr-4 text-muted">{p.slot}</td>
                <td className="py-3 pr-4"><AvatarChip name={p.rider} /></td>
                <td className="py-3 pr-4">{p.rider ? <Pill status={p.arrival} /> : <span className="text-muted">—</span>}</td>
                <td className="py-3 pr-4"><Pill status={p.status} />{p.fail && <div className="text-xs text-muted mt-1">{p.fail}</div>}</td>
                <td className="py-3">
                  {p.status === 'Pending'
                    ? <button onClick={() => onQuickAssign(p.id)} className="text-xs font-bold text-orange border border-orange/30 rounded-lg px-3 py-1.5 hover:bg-[#FBF3EA]">Quick Assign</button>
                    : <span className="text-muted text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================
// VIEW: DELIVERIES
// ============================================================
function DeliveriesView({ deliveries, ready, out, done, failed, search, setSearch, statusFilter, setStatusFilter, onReschedule }: any) {
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <StatStrip items={[
        { num: ready, label: 'Ready for Delivery' },
        { num: out, label: 'Out for Delivery' },
        { num: done, label: 'Completed' },
        { num: failed, label: 'Failed Attempts' },
      ]} />

      <div className="flex flex-col sm:flex-row gap-3 my-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input type="text" placeholder="Search customer or order ID…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm py-2.5 pl-9 pr-3 rounded-lg border border-line bg-page outline-none focus:border-orange" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm py-2.5 px-3 rounded-lg border border-line bg-page outline-none">
          <option value="">Any status</option>
          <option>Ready</option><option>Out for Delivery</option><option>Delivered</option><option>Failed</option><option>Rescheduled</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted text-xs">
              <th className="py-2.5 pr-4">Order ID</th><th className="py-2.5 pr-4">Customer / Zone</th>
              <th className="py-2.5 pr-4">Assigned Rider</th><th className="py-2.5 pr-4">Progress</th>
              <th className="py-2.5 pr-4">Status</th><th className="py-2.5 pr-4">Proof</th><th className="py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d: Delivery) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="py-3 pr-4 font-mono text-xs text-ink">{d.id}</td>
                <td className="py-3 pr-4">{d.customer}<div className="text-xs text-muted">{d.zone}</div></td>
                <td className="py-3 pr-4"><AvatarChip name={d.rider} /></td>
                <td className="py-3 pr-4 min-w-[100px]">
                  <div className="h-1.5 bg-line rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${d.progress}%`, background: d.status === 'Failed' ? '#D8432C' : '#F2701A' }} />
                  </div>
                </td>
                <td className="py-3 pr-4"><Pill status={d.status} /></td>
                <td className="py-3 pr-4 text-muted">{d.proof}</td>
                <td className="py-3">
                  {d.status === 'Failed'
                    ? <button onClick={() => onReschedule(d.id)} className="text-xs font-bold text-orange border border-orange/30 rounded-lg px-3 py-1.5 hover:bg-[#FBF3EA]">Reschedule</button>
                    : <span className="text-muted text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================
// VIEW: PARCEL OPERATIONS
// ============================================================
function ParcelOpsView({ scanInput, setScanInput, scanLog, onScan, toast }: any) {
  return (
    <>
      <section className="bg-white border border-line rounded-2xl p-5">
        <h2 className="font-display font-bold text-base mb-1">Scan Parcel</h2>
        <p className="text-xs text-muted mb-4">Simulate barcode / QR scan for incoming or outgoing parcels</p>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input type="text" placeholder="Enter or scan tracking barcode…" value={scanInput} onChange={(e) => setScanInput(e.target.value)}
            className="flex-1 text-sm py-2.5 px-3.5 rounded-lg border border-line bg-page outline-none focus:border-orange" />
          <button onClick={() => onScan('Incoming')} className="bg-navy hover:bg-navy-light text-white font-bold text-sm px-4 py-2.5 rounded-lg whitespace-nowrap">Scan Incoming</button>
          <button onClick={() => onScan('Outgoing')} className="border border-line text-ink font-bold text-sm px-4 py-2.5 rounded-lg whitespace-nowrap hover:bg-page">Scan Outgoing</button>
        </div>
        <div className="mt-4 flex flex-col gap-2 max-h-48 overflow-y-auto">
          {scanLog.length === 0
            ? <div className="text-xs text-muted">No scans yet — enter a tracking ID above.</div>
            : scanLog.slice(0, 8).map((s: ScanLogEntry, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm border-b border-line last:border-0 pb-2">
                <Pill status={s.type === 'Incoming' ? 'blue' : 'amber'} label={s.type} />
                <span className="font-mono text-xs">{s.id}</span>
                <span className="text-xs text-muted ml-auto">{s.time}</span>
              </div>
            ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Receiving Queue</h2>
          <p className="text-xs text-muted mb-3">Awaiting sort</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Tracking ID</th><th className="py-2">From Branch</th><th className="py-2">Sorting Status</th></tr></thead>
            <tbody>
              {RECEIVING_QUEUE.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 font-mono text-xs">{r.id}</td><td className="py-2.5">{r.from}</td>
                  <td className="py-2.5"><Pill status={r.sort === 'Sorted' ? 'green' : r.sort === 'In Progress' ? 'amber' : 'gray'} label={r.sort} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Dispatch Queue</h2>
          <p className="text-xs text-muted mb-3">Ready to leave the branch</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Tracking ID</th><th className="py-2">To Branch</th><th className="py-2">Dispatch Status</th></tr></thead>
            <tbody>
              {DISPATCH_QUEUE.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 font-mono text-xs">{r.id}</td><td className="py-2.5">{r.to}</td>
                  <td className="py-2.5"><Pill status={r.status === 'Loading' ? 'amber' : 'blue'} label={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="bg-white border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-bold text-base">Transfer History</h2>
            <p className="text-xs text-muted">Inter-branch parcel movements</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => toast('Damaged parcel report submitted.')} className="text-xs font-bold border border-line rounded-lg px-3 py-1.5 hover:bg-page">Report Damaged</button>
            <button onClick={() => toast('Missing parcel alert raised to ops team.')} className="text-xs font-bold border border-line rounded-lg px-3 py-1.5 hover:bg-page">Report Missing</button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Tracking ID</th><th className="py-2">Direction</th><th className="py-2">Branch</th><th className="py-2">Date</th></tr></thead>
          <tbody>
            {TRANSFER_HISTORY.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="py-2.5 font-mono text-xs">{r.id}</td>
                <td className="py-2.5"><Pill status={r.dir === 'Inbound' ? 'blue' : 'amber'} label={r.dir} /></td>
                <td className="py-2.5">{r.branch}</td><td className="py-2.5 text-muted">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

// ============================================================
// VIEW: WAREHOUSE
// ============================================================
function WarehouseView({ shelfCells }: { shelfCells: ('low' | 'mid' | 'high')[] }) {
  const shelfColor = { low: '#EAF7EF', mid: '#FDF1DD', high: '#FBEAE7' };
  const shelfBorder = { low: '#1E8E5A', mid: '#F2A93B', high: '#D8432C' };
  return (
    <>
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Storage Capacity</h2>
          <p className="text-xs text-muted mb-4">Rack occupancy across the warehouse floor</p>
          <div className="grid grid-cols-10 gap-1.5">
            {shelfCells.length === 0
              ? Array.from({ length: 60 }).map((_, i) => <div key={i} className="aspect-square rounded bg-line animate-pulse" />)
              : shelfCells.map((c, i) => (
                <div key={i} className="aspect-square rounded" style={{ background: shelfColor[c], border: `1px solid ${shelfBorder[c]}` }} />
              ))}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: shelfColor.low, border: `1px solid ${shelfBorder.low}` }} />Low</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: shelfColor.mid, border: `1px solid ${shelfBorder.mid}` }} />Mid</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: shelfColor.high, border: `1px solid ${shelfBorder.high}` }} />Near capacity</span>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-4">Capacity Usage</h2>
          <div className="flex items-center gap-6">
            <div className="w-28 h-28 rounded-full flex items-center justify-center flex-none" style={{ background: 'conic-gradient(#2563EB 0% 72%, #E4E8F0 72% 100%)' }}>
              <div className="w-20 h-20 rounded-full bg-white flex flex-col items-center justify-center">
                <b className="text-lg font-display">72%</b><span className="text-xs text-muted">used</span>
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
              { num: AGING_PARCELS.length, label: 'Aging Parcels' },
            ]} />
          </div>
        </section>
      </div>

      <section className="bg-white border border-line rounded-2xl p-5">
        <h2 className="font-display font-bold text-base mb-1">Aging Parcels</h2>
        <p className="text-xs text-muted mb-3">Parcels sitting longest without movement</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Tracking ID</th><th className="py-2">Shelf Location</th><th className="py-2">Days in Warehouse</th><th className="py-2">Status</th></tr></thead>
          <tbody>
            {AGING_PARCELS.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0">
                <td className="py-2.5 font-mono text-xs">{a.id}</td><td className="py-2.5">{a.shelf}</td>
                <td className="py-2.5">{a.days} days</td>
                <td className="py-2.5"><Pill status={a.days > 5 ? 'red' : 'amber'} label={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
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
      <section className="bg-white border border-line rounded-2xl p-5">
        <h2 className="font-display font-bold text-base mb-1">Rider Roster</h2>
        <p className="text-xs text-muted mb-4">Availability, live status and performance</p>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {riders.map((r: typeof INITIAL_RIDERS[number]) => {
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
                    <div className="text-xs text-muted">{r.vehicle}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs mb-3">
                  <div><div className="text-muted">Status</div><div className="font-semibold text-ink">{r.status === 'online' ? 'Available' : r.status === 'busy' ? 'On Delivery' : 'Offline'}</div></div>
                  <div><div className="text-muted">Success Rate</div><div className="font-semibold text-ink">{r.success}%</div></div>
                  <div className="col-span-2"><div className="text-muted">GPS Location</div><div className="font-semibold text-ink text-[0.72rem]">{r.gps}</div></div>
                  <div className="col-span-2"><div className="text-muted">Performance</div><div className="text-orange">{'★'.repeat(Math.round(r.score))}{'☆'.repeat(5 - Math.round(r.score))}</div></div>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-xs text-muted">{r.deliveries} deliveries today</span>
                  <button onClick={() => toast(`Shipment assignment started for ${r.name}.`)} className="text-xs font-bold text-orange border border-orange/30 rounded-lg px-3 py-1.5 hover:bg-[#FBF3EA]">Assign</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

// ============================================================
// VIEW: STAFF
// ============================================================
function StaffView() {
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-base">Branch Staff</h2>
          <p className="text-xs text-muted">Roles, attendance and permissions</p>
        </div>
        <button className="bg-orange hover:bg-orange-light text-white font-bold text-xs px-4 py-2 rounded-lg">+ Add Staff</button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Name</th><th className="py-2">Role</th><th className="py-2">Attendance</th><th className="py-2">Contact</th><th className="py-2">Permissions</th></tr></thead>
        <tbody>
          {STAFF.map((s) => (
            <tr key={s.name} className="border-b border-line last:border-0">
              <td className="py-3"><AvatarChip name={s.name} /></td>
              <td className="py-3">{s.role}</td>
              <td className="py-3"><Pill status={s.attendance} /></td>
              <td className="py-3 text-muted">{s.contact}</td>
              <td className="py-3"><Pill status="blue" label={s.perm} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ============================================================
// VIEW: SERVICE AREA
// ============================================================
function ServiceAreaView() {
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <h2 className="font-display font-bold text-base mb-1">Coverage Zones</h2>
      <p className="text-xs text-muted mb-4">Cities, postal codes and delivery capabilities served by this branch</p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Zone</th><th className="py-2">Postal Codes</th><th className="py-2">Delivery Radius</th><th className="py-2">Same-Day</th><th className="py-2">Express</th></tr></thead>
        <tbody>
          {ZONES.map((z) => (
            <tr key={z.zone} className="border-b border-line last:border-0">
              <td className="py-3 font-bold text-ink">{z.zone}</td>
              <td className="py-3 font-mono text-xs text-muted">{z.codes}</td>
              <td className="py-3">{z.radius}</td>
              <td className="py-3"><Pill status={z.sameDay ? 'green' : 'gray'} label={z.sameDay ? 'Available' : 'Not available'} /></td>
              <td className="py-3"><Pill status={z.express ? 'blue' : 'gray'} label={z.express ? 'Available' : 'Not available'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ============================================================
// VIEW: MAP
// ============================================================
function MapView({ riders }: { riders: typeof INITIAL_RIDERS }) {
  const activeRiders = riders.filter((r) => r.status !== 'offline').slice(0, 7).map((r, i) => ({
    x: 15 + (i * 11) % 80, y: 15 + (i * 23) % 75, busy: r.status === 'busy', name: r.name,
  }));
  const pickupPins = [{ x: 22, y: 30, label: 'PK-70233' }, { x: 70, y: 20, label: 'PK-70234' }];
  const deliveryPins = [{ x: 35, y: 70, label: 'FX-582012' }, { x: 80, y: 60, label: 'FX-582015' }, { x: 55, y: 85, label: 'FX-582020' }];

  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-base">Live Operations Map</h2>
          <p className="text-xs text-muted">Branch, riders, pickups and deliveries in real time</p>
        </div>
        <Pill status="amber" label="Moderate traffic" />
      </div>
      <div className="relative w-full aspect-[16/9] bg-page rounded-xl overflow-hidden border border-line">
        <MapPin x={50} y={50} color="#0F2648" label="Lahore Central" />
        {activeRiders.map((r) => <MapPin key={r.name} x={r.x} y={r.y} color={r.busy ? '#2563EB' : '#B7BEC9'} label={r.name.split(' ')[0]} />)}
        {pickupPins.map((p) => <MapPin key={p.label} x={p.x} y={p.y} color="#F2A93B" label={p.label} />)}
        {deliveryPins.map((d) => <MapPin key={d.label} x={d.x} y={d.y} color="#1E8E5A" label={d.label} />)}
      </div>
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-navy" />Branch</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-[#2563EB]" />Rider (active)</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-[#B7BEC9]" />Rider (idle)</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-[#F2A93B]" />Pickup</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-success" />Delivery</span>
      </div>
    </section>
  );
}

function MapPin({ x, y, color, label }: { x: number; y: number; color: string; label: string }) {
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
function ReportsView({ riders }: { riders: typeof INITIAL_RIDERS }) {
  const week = [{ d: 'Mon', v: 360 }, { d: 'Tue', v: 388 }, { d: 'Wed', v: 410 }, { d: 'Thu', v: 395 }, { d: 'Fri', v: 430 }, { d: 'Sat', v: 448 }, { d: 'Sun', v: 412 }];
  const max = Math.max(...week.map((w) => w.v));
  const topRiders = [...riders].sort((a, b) => b.deliveries - a.deliveries).slice(0, 6);
  const comparisons = [
    { label: 'Delivery Success Rate', branch: 91, network: 87 },
    { label: 'On-Time Pickup Rate', branch: 88, network: 84 },
    { label: 'Avg. Delivery Time (lower is better)', branch: 74, network: 80 },
  ];

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-4">Shipments — Last 7 Days</h2>
          <div className="flex items-end gap-3 h-40">
            {week.map((w) => (
              <div key={w.d} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-xs font-semibold text-ink">{w.v}</span>
                <div className="w-full bg-orange rounded-t" style={{ height: `${(w.v / max) * 100}%` }} />
                <span className="text-xs text-muted">{w.d}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-4">Delivery Success Rate</h2>
          <div className="flex items-center gap-6">
            <div className="w-28 h-28 rounded-full flex items-center justify-center flex-none" style={{ background: 'conic-gradient(#1E8E5A 0% 91%, #D8432C 91% 96%, #E4E8F0 96% 100%)' }}>
              <div className="w-20 h-20 rounded-full bg-white flex flex-col items-center justify-center">
                <b className="text-lg font-display">91%</b><span className="text-xs text-muted">success</span>
              </div>
            </div>
            <ul className="text-sm space-y-1.5">
              <li className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-sm inline-block bg-success" />Delivered <b>91%</b></li>
              <li className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-sm inline-block bg-danger" />Failed <b>5%</b></li>
              <li className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-sm inline-block bg-line" />Returned <b>4%</b></li>
            </ul>
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Rider Productivity</h2>
          <p className="text-xs text-muted mb-3">Top performers this week</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Rider</th><th className="py-2">Deliveries</th><th className="py-2">Success Rate</th></tr></thead>
            <tbody>
              {topRiders.map((r) => (
                <tr key={r.name} className="border-b border-line last:border-0">
                  <td className="py-2.5"><AvatarChip name={r.name} /></td>
                  <td className="py-2.5">{r.deliveries}</td>
                  <td className="py-2.5"><Pill status={r.success >= 93 ? 'green' : 'amber'} label={`${r.success}%`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-4">Branch vs. Network Average</h2>
          <div className="flex flex-col gap-4">
            {comparisons.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs font-semibold text-ink mb-1"><span>{c.label}</span><span>{c.branch}% vs {c.network}%</span></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden mb-1"><div className="h-full bg-orange" style={{ width: `${c.branch}%` }} /></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden"><div className="h-full bg-[#B7BEC9]" style={{ width: `${c.network}%` }} /></div>
              </div>
            ))}
            <div className="text-xs text-muted mt-1"><span className="text-orange font-bold">■</span> This branch &nbsp; <span className="text-[#B7BEC9] font-bold">■</span> Network average</div>
          </div>
        </section>
      </div>

      <section className="bg-white border border-line rounded-2xl p-5">
        <h2 className="font-display font-bold text-base mb-4">Summary Metrics</h2>
        <StatStrip items={[
          { num: '28 min', label: 'Avg Delivery Time' },
          { num: '89%', label: 'Pickup Efficiency' },
          { num: 'Rs 486,300', label: 'COD Collected Today' },
          { num: 6, label: 'Customer Complaints (7d)' },
          { num: '#2', label: 'Network Rank of 8' },
        ]} />
      </section>
    </>
  );
}

// ============================================================
// VIEW: ALERTS
// ============================================================
function AlertsView() {
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <h2 className="font-display font-bold text-base mb-1">Alerts & Notifications</h2>
      <p className="text-xs text-muted mb-4">Everything flagged for branch manager review</p>
      <div className="flex flex-col gap-2.5">
        {ALERTS.map((a, i) => <AlertCard key={i} alert={a} />)}
      </div>
    </section>
  );
}

function AlertCard({ alert }: { alert: { sev: string; title: string; msg: string; time: string } }) {
  const border = alert.sev === 'high' ? '#D8432C' : alert.sev === 'medium' ? '#F2A93B' : '#B7BEC9';
  return (
    <div className="flex gap-3 border-l-4 rounded-lg bg-page p-3.5" style={{ borderColor: border }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-none text-white" style={{ background: border }}>
        <NavIcon name="alert" size={13} />
      </div>
      <div>
        <div className="font-bold text-sm text-ink">{alert.title}</div>
        <div className="text-xs text-muted mt-0.5">{alert.msg}</div>
        <div className="text-xs text-muted/70 mt-1">{alert.time}</div>
      </div>
    </div>
  );
}

// ============================================================
// ICONS
// ============================================================
function NavBadge({ n, danger }: { n: number; danger?: boolean }) {
  return (
    <span className={`text-[0.66rem] font-bold px-1.5 py-0.5 rounded-full ${danger ? 'bg-danger text-white' : 'bg-white/15 text-white'}`}>
      {n}
    </span>
  );
}

function NavIcon({ name, size = 16, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    pickup: <><path d="M20 8h-3l-2-3H9L7 8H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" /><circle cx="12" cy="14" r="3" /></>,
    truck: <><rect x="1" y="6" width="15" height="11" /><path d="M16 10h4l3 3v4h-7z" /><circle cx="6" cy="18" r="2" /><circle cx="18.5" cy="18" r="2" /></>,
    box: <><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
    warehouse: <><path d="M3 21V9l9-6 9 6v12H3z" /><path d="M9 21v-8h6v8" /></>,
    riders: <><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><path d="M2 21c0-3.5 2.5-6 6-6M22 21c0-3.5-2.5-6-6-6" /><circle cx="12" cy="15" r="3" /><path d="M6 21c0-3 2.7-5 6-5s6 2 6 5" /></>,
    staff: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
    pin: <><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
    map: <><path d="M1 6v15l7-3 8 3 7-3V3l-7 3-8-3z" /><path d="M8 3v15M16 6v15" /></>,
    reports: <><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>,
    alert: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    rider: <><circle cx="12" cy="7" r="3" /><path d="M5 21c0-4 3-7 7-7s7 3 7 7" /></>,
    return: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.box}
    </svg>
  );
}
