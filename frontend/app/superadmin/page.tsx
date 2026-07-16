'use client';

import { useEffect, useMemo, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/context/AuthContext';
import { Field } from '@/components/Field';
import {
  ApiError,
  getAdminAnalytics,
  AdminAnalytics,
  listAllOrders,
  Order as ApiOrder,
  listRiders,
  AdminRider,
  RiderCard,
  listBranches,
  Branch,
  listZones,
  Zone,
  listStaffAndRiders,
  AdminUser,
  createStaffOrRider,
  AdminCreateUserPayload,
  assignRider,
  deleteUserbyAdmin,
} from '@/lib/api';
import {
  BUSINESS_ACCOUNTS, ASSIGNMENT_RULES, MESSAGE_TEMPLATES, SYSTEM_ALERTS,
  NETWORK_ACTIVITY, NETWORK_COMPARISON, BusinessAccount, AssignmentRule, MessageTemplate, AdminAlert,
} from './data';
import {
  Pill, AvatarChip, KpiCard, StatStrip, Toasts, NavIcon, NavBadge, Modal, inputCls,
} from './components';

type View =
  | 'overview' | 'orders' | 'map'
  | 'riders' | 'assignment'
  | 'branches' | 'zones'
  | 'staff' | 'business'
  | 'messaging'
  | 'reports' | 'alerts'
  | 'settings';

const NAV_SECTIONS: { label: string; items: { view: View; label: string; icon: string }[] }[] = [
  { label: 'Operations', items: [
    { view: 'overview', label: 'Overview', icon: 'grid' },
    { view: 'orders', label: 'All Orders', icon: 'box' },
    { view: 'map', label: 'Live Map', icon: 'map' },
  ]},
  { label: 'Rider Ops', items: [
    { view: 'riders', label: 'Rider Fleet', icon: 'riders' },
    { view: 'assignment', label: 'Assignment Rules', icon: 'target' },
  ]},
  { label: 'Network', items: [
    { view: 'branches', label: 'Branches', icon: 'building' },
    { view: 'zones', label: 'Service Zones', icon: 'zone' },
  ]},
  { label: 'Accounts', items: [
    { view: 'staff', label: 'Staff & Admins', icon: 'staff' },
    { view: 'business', label: 'Business Accounts', icon: 'business' },
  ]},
  { label: 'Engagement', items: [
    { view: 'messaging', label: 'Messaging Templates', icon: 'message' },
  ]},
  { label: 'Insights', items: [
    { view: 'reports', label: 'Reports', icon: 'reports' },
    { view: 'alerts', label: 'Alerts', icon: 'alert' },
  ]},
  { label: 'System', items: [
    { view: 'settings', label: 'Settings', icon: 'settings' },
  ]},
];

const PAGE_META: Record<View, { title: string; sub: string }> = {
  overview: { title: 'Super Admin Overview', sub: 'Network-wide performance, live in one place' },
  orders: { title: 'All Orders', sub: 'Every order across every branch and channel' },
  map: { title: 'Live Operations Map', sub: 'Branches and riders across the whole network' },
  riders: { title: 'Rider Fleet', sub: 'Every rider, every branch, live status' },
  assignment: { title: 'Rider Assignment', sub: 'Automatic rules, proximity logic and manual overrides' },
  branches: { title: 'Branches', sub: 'Manage every branch in the network' },
  zones: { title: 'Service Zones', sub: 'Coverage areas and delivery capabilities' },
  staff: { title: 'Staff & Admins', sub: 'Every internal account and its role' },
  business: { title: 'Business Accounts', sub: 'Corporate and merchant shipping accounts' },
  messaging: { title: 'Messaging Templates', sub: 'Automatic SMS, WhatsApp, email and push notifications' },
  reports: { title: 'Reports & Analytics', sub: 'Network performance trends' },
  alerts: { title: 'Alerts & Notifications', sub: 'Everything flagged for super admin review' },
  settings: { title: 'System Settings', sub: 'Defaults that apply across the whole network' },
};

function titleStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapAdminRiders(apiRiders: AdminRider[]): RiderCard[] {
  return apiRiders.map((r) => ({
    name: r.full_name,
    vehicle: `${r.vehicle_type || 'Vehicle'} · ${r.phone}`,
    status: r.is_available ? 'online' : 'offline',
    score: r.rating ?? 5,
    success: Math.round((r.rating ?? 5) * 20),
    deliveries: 0,
    gps: r.is_available ? 'Available for assignment' : 'Unavailable',
  }));
}

export default function AdminDashboardPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <AdminDashboardContent />
    </RoleGuard>
  );
}

function AdminDashboardContent() {
  const { token } = useAuth();

  const [view, setView] = useState<View>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  const [analytics, setAnalytics] = useState<AdminAnalytics>();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [adminRiders, setAdminRiders] = useState<AdminRider[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  // local/mock-backed sections (no endpoint yet)
  const [assignmentRules, setAssignmentRules] = useState<AssignmentRule[]>(ASSIGNMENT_RULES);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>(MESSAGE_TEMPLATES);
  const [businessAccounts] = useState<BusinessAccount[]>(BUSINESS_ACCOUNTS);
  const [alerts] = useState<AdminAlert[]>(SYSTEM_ALERTS);

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  const [assignModalOrder, setAssignModalOrder] = useState<ApiOrder | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const riders = useMemo(() => mapAdminRiders(adminRiders), [adminRiders]);

  function toast(msg: string) {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }

  function switchView(v: View) {
    setView(v);
    setSidebarOpen(false);
  }

  function loadAll() {
    if (!token) return;
    setSyncing(true);
    setSyncError('');
    Promise.all([
      getAdminAnalytics(token),
      listAllOrders(token),
      listRiders(token),
      listBranches(token),
      listZones(token),
      listStaffAndRiders(token),
    ])
      .then(([a, o, r, b, z, u]) => {
        setAnalytics(a);
        setOrders(o);
        setAdminRiders(r);
        setBranches(b);
        setZones(z);
        setUsers(u);
      })
      .catch((err) => {
        setSyncError(err instanceof ApiError ? err.message : 'Could not sync network data with backend.');
      })
      .finally(() => setSyncing(false));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAssignRider(riderId: string) {
    if (!token || !assignModalOrder) return;
    try {
      await assignRider(assignModalOrder.id, riderId, token);
      toast(`Rider assigned to ${assignModalOrder.tracking_number}.`);
      setAssignModalOrder(null);
      loadAll();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not assign rider.');
    }
  }

  async function handleCreateUser(payload: AdminCreateUserPayload) {
    if (!token) return;
    try {
      await createStaffOrRider(payload, token);
      toast(`${titleStatus(payload.role)} account created for ${payload.full_name}.`);
      setShowCreateUser(false);
      loadAll();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create account.');
    }
  }

  async function handleDeleteUser(u: AdminUser) {
    if (!token) return;
    if (!confirm(`Remove ${u.full_name}'s account? This can't be undone.`)) return;
    try {
      await deleteUserbyAdmin(u.id, token);
      toast(`${u.full_name}'s account removed.`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove account.');
    }
  }

  function toggleRule(id: string) {
    setAssignmentRules((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  }

  function toggleTemplate(id: string) {
    setMessageTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, active: !t.active } : t)));
  }

  // ---- derived ----
  const onlineRiders = riders.filter((r) => r.status === 'online').length;
  const busyRiders = riders.filter((r) => r.status === 'busy').length;
  const offlineRiders = riders.filter((r) => r.status === 'offline').length;
  const unassignedOrders = orders.filter((o) => !o.rider_accepted && (o.status === 'created' || o.status === 'assigned'));

  const filteredOrders = useMemo(() => orders.filter((o) => {
    if (orderStatusFilter && o.status !== orderStatusFilter) return false;
    const q = orderSearch.trim().toLowerCase();
    if (q) {
      const hay = [o.tracking_number, o.pickup_address?.contact_name, o.dropoff_address?.contact_name, o.pickup_address?.city, o.dropoff_address?.city]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [orders, orderSearch, orderStatusFilter]);

  const filteredUsers = useMemo(() => users.filter((u) => !userRoleFilter || u.role === userRoleFilter), [users, userRoleFilter]);

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
            <div className="text-[0.6rem] tracking-[0.2em] text-white/50 font-semibold mt-0.5">SUPER ADMIN</div>
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
                {item.view === 'orders' && <NavBadge n={unassignedOrders.length} />}
                {item.view === 'riders' && <NavBadge n={onlineRiders + busyRiders} />}
                {item.view === 'alerts' && <NavBadge n={alerts.length} danger />}
              </button>
            ))}
          </div>
        ))}

        <div className="mt-auto pt-4 border-t border-white/10 text-xs text-white/50">
          {branches.length} branches · {zones.length} zones
          <div className="text-white/70 font-semibold mt-0.5">Network Control Center</div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

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
            <NavIcon name="alert" size={17} />
            {alerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-danger text-white text-[0.6rem] font-bold flex items-center justify-center">{alerts.length}</span>
            )}
          </button>
          {view === 'staff' && (
            <button onClick={() => setShowCreateUser(true)} className="hidden sm:flex items-center gap-1.5 bg-orange hover:bg-orange-light text-white font-bold text-sm px-4 py-2.5 rounded-[10px] transition-colors whitespace-nowrap">
              <NavIcon name="plus" size={14} color="#fff" /> New Account
            </button>
          )}
        </div>

        <div className="p-5 md:p-8 flex flex-col gap-6">
          {(syncing || syncError) && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${syncError ? 'bg-[#FBEAE7] border-danger/30 text-danger' : 'bg-[#EAF1FC] border-[#2563EB]/20 text-navy'}`}>
              {syncError || 'Syncing network data with backend...'}
            </div>
          )}

          {view === 'overview' && (
            <OverviewView analytics={analytics} branches={branches} zones={zones} onlineRiders={onlineRiders}
              busyRiders={busyRiders} unassignedOrders={unassignedOrders.length} switchView={switchView} />
          )}

          {view === 'orders' && (
            <OrdersView orders={filteredOrders} total={orders.length} search={orderSearch} setSearch={setOrderSearch}
              statusFilter={orderStatusFilter} setStatusFilter={setOrderStatusFilter}
              onAssign={(o) => setAssignModalOrder(o)} />
          )}

          {view === 'map' && <MapView branches={branches} riders={riders} />}

          {view === 'riders' && (
            <RidersView riders={riders} onlineRiders={onlineRiders} busyRiders={busyRiders} offlineRiders={offlineRiders} />
          )}

          {view === 'assignment' && (
            <AssignmentView rules={assignmentRules} onToggle={toggleRule} unassignedOrders={unassignedOrders}
              openAssign={(o) => setAssignModalOrder(o)} />
          )}

          {view === 'branches' && <BranchesView branches={branches} zones={zones} />}

          {view === 'zones' && <ZonesView zones={zones} branches={branches} />}

          {view === 'staff' && (
            <StaffView users={filteredUsers} roleFilter={userRoleFilter} setRoleFilter={setUserRoleFilter}
              onDelete={handleDeleteUser} />
          )}

          {view === 'business' && <BusinessView accounts={businessAccounts} />}

          {view === 'messaging' && <MessagingView templates={messageTemplates} onToggle={toggleTemplate} />}

          {view === 'reports' && <ReportsView analytics={analytics} riders={riders} />}

          {view === 'alerts' && <AlertsView alerts={alerts} />}

          {view === 'settings' && <SettingsView toast={toast} />}
        </div>
      </div>

      {assignModalOrder && (
        <AssignRiderModal order={assignModalOrder} riders={adminRiders} onClose={() => setAssignModalOrder(null)} onAssign={handleAssignRider} />
      )}

      {showCreateUser && (
        <CreateUserModal branches={branches} zones={zones} onClose={() => setShowCreateUser(false)} onCreate={handleCreateUser} />
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}

// ============================================================
// OVERVIEW
// ============================================================
function OverviewView({ analytics, branches, zones, onlineRiders, busyRiders, unassignedOrders, switchView }: {
  analytics?: AdminAnalytics; branches: Branch[]; zones: Zone[]; onlineRiders: number; busyRiders: number;
  unassignedOrders: number; switchView: (v: View) => void;
}) {
  const kpis = [
    { icon: 'box', bg: '#2563EB', label: 'Total Orders', num: analytics?.total_orders ?? '—', trend: 'All channels, all time', trendColor: '#8A94A6' },
    { icon: 'dollar', bg: '#1E8E5A', label: 'Total Revenue', num: analytics ? `Rs ${analytics.total_revenue.toLocaleString()}` : '—', trend: 'Network-wide', trendColor: '#1E8E5A' },
    { icon: 'clock', bg: '#F2A93B', label: 'Unassigned Orders', num: unassignedOrders, trend: 'Needs a rider', trendColor: '#B8710A' },
    { icon: 'riders', bg: '#1E8E5A', label: 'Riders Online', num: onlineRiders, trend: 'Ready for dispatch', trendColor: '#1E8E5A' },
    { icon: 'riders', bg: '#F2A93B', label: 'Riders on Delivery', num: busyRiders, trend: 'Active routes', trendColor: '#B8710A' },
    { icon: 'building', bg: '#173868', label: 'Branches', num: branches.length, trend: 'Across the network', trendColor: '#8A94A6' },
    { icon: 'zone', bg: '#2563EB', label: 'Service Zones', num: zones.length, trend: 'Coverage areas', trendColor: '#8A94A6' },
    { icon: 'check', bg: '#1E8E5A', label: 'Delivered', num: analytics?.status_counts?.delivered ?? 0, trend: 'Completed orders', trendColor: '#1E8E5A' },
  ];

  const quickActions: { icon: string; label: string; goto: View }[] = [
    { icon: 'box', label: 'Review Orders', goto: 'orders' },
    { icon: 'target', label: 'Assignment Rules', goto: 'assignment' },
    { icon: 'building', label: 'Manage Branches', goto: 'branches' },
    { icon: 'staff', label: 'Staff & Admins', goto: 'staff' },
    { icon: 'message', label: 'Messaging Templates', goto: 'messaging' },
    { icon: 'reports', label: 'Full Reports', goto: 'reports' },
  ];

  const week = analytics?.daily_last_7_days ?? [];
  const maxOrders = Math.max(1, ...week.map((d) => d.orders));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map(({ icon, ...k }) => <KpiCard key={k.label} icon={<NavIcon name={icon} />} {...k} />)}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Orders — Last 7 Days</h2>
          <p className="text-xs text-muted mb-4">Network-wide order volume</p>
          {week.length === 0 ? (
            <div className="text-sm text-muted">No data yet.</div>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {week.map((w) => (
                <div key={w.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs font-semibold text-ink">{w.orders}</span>
                  <div className="w-full bg-orange rounded-t" style={{ height: `${(w.orders / maxOrders) * 100}%` }} />
                  <span className="text-xs text-muted">{new Date(w.date).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Recent Network Activity</h2>
          <p className="text-xs text-muted mb-4">Latest changes across the platform</p>
          <div className="flex flex-col gap-3">
            {NETWORK_ACTIVITY.map((a, i) => (
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
      </div>

      <section className="bg-white border border-line rounded-2xl p-5">
        <h2 className="font-display font-bold text-base mb-1">Quick Actions</h2>
        <p className="text-xs text-muted mb-4">Jump to common super admin tasks</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {quickActions.map((q) => (
            <button key={q.label} onClick={() => switchView(q.goto)}
              className="flex flex-col items-center gap-2 border border-line rounded-xl p-4 text-xs font-semibold text-ink hover:border-orange hover:bg-page transition-colors text-center">
              <NavIcon name={q.icon} size={18} color="#0F2648" />
              {q.label}
            </button>
          ))}
        </div>
      </section>

      {analytics?.top_riders && analytics.top_riders.length > 0 && (
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Top Performing Riders</h2>
          <p className="text-xs text-muted mb-3">By completed deliveries, network-wide</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Rider</th><th className="py-2">Deliveries</th><th className="py-2">Earnings</th></tr></thead>
            <tbody>
              {analytics.top_riders.map((r) => (
                <tr key={r.full_name} className="border-b border-line last:border-0">
                  <td className="py-2.5"><AvatarChip name={r.full_name} /></td>
                  <td className="py-2.5">{r.deliveries}</td>
                  <td className="py-2.5">Rs {r.earnings.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

// ============================================================
// ORDERS
// ============================================================
function OrdersView({ orders, total, search, setSearch, statusFilter, setStatusFilter, onAssign }: {
  orders: ApiOrder[]; total: number; search: string; setSearch: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void; onAssign: (o: ApiOrder) => void;
}) {
  const statuses = ['created', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'];
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <StatStrip items={[
        { num: total, label: 'Total Orders' },
        { num: orders.filter((o) => o.status === 'created').length, label: 'Awaiting Assignment (filtered)' },
        { num: orders.filter((o) => o.status === 'delivered').length, label: 'Delivered (filtered)' },
        { num: orders.filter((o) => o.status === 'failed' || o.status === 'cancelled').length, label: 'Failed / Cancelled (filtered)' },
      ]} />

      <div className="flex flex-col sm:flex-row gap-3 my-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
            <NavIcon name="search" size={16} color="#8A94A6" />
          </span>
          <input type="text" placeholder="Search tracking number, customer or city…" value={search} onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls + ' sm:w-56'}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s} value={s}>{titleStatus(s)}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted text-xs">
              <th className="py-2.5 pr-4">Tracking #</th><th className="py-2.5 pr-4">Customer</th>
              <th className="py-2.5 pr-4">Route</th><th className="py-2.5 pr-4">Channel</th>
              <th className="py-2.5 pr-4">Price</th><th className="py-2.5 pr-4">Rider</th>
              <th className="py-2.5 pr-4">Status</th><th className="py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="py-3 pr-4 font-mono text-xs text-ink">{o.tracking_number}</td>
                <td className="py-3 pr-4">{o.pickup_address?.contact_name || o.dropoff_address?.contact_name || 'Guest'}</td>
                <td className="py-3 pr-4 text-xs text-muted">{o.pickup_address?.city || '—'} → {o.dropoff_address?.city || '—'}</td>
                <td className="py-3 pr-4"><Pill status="gray" label={titleStatus(o.booking_channel || 'app')} /></td>
                <td className="py-3 pr-4">{o.final_price ?? o.estimated_price ?? '—'}</td>
                <td className="py-3 pr-4">{o.rider_accepted ? <Pill status="green" label="Assigned" /> : <Pill status="amber" label="Unassigned" />}</td>
                <td className="py-3 pr-4"><Pill status={o.status} /></td>
                <td className="py-3">
                  {!o.rider_accepted && o.status !== 'cancelled' && o.status !== 'delivered'
                    ? <button onClick={() => onAssign(o)} className="text-xs font-bold text-orange border border-orange/30 rounded-lg px-3 py-1.5 hover:bg-[#FBF3EA]">Assign Rider</button>
                    : <span className="text-muted text-xs">—</span>}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-sm text-muted">No orders match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AssignRiderModal({ order, riders, onClose, onAssign }: {
  order: ApiOrder; riders: AdminRider[]; onClose: () => void; onAssign: (riderId: string) => void;
}) {
  const available = riders.filter((r) => r.is_available);
  return (
    <Modal title={`Assign rider · ${order.tracking_number}`} onClose={onClose}>
      <p className="text-sm text-muted mb-4">Choose an available rider to send this order to. They'll get a notification to accept or decline.</p>
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
        {available.length === 0 && <div className="text-sm text-muted">No riders are currently available.</div>}
        {available.map((r) => (
          <button key={r.rider_id} onClick={() => onAssign(r.rider_id)}
            className="flex items-center justify-between gap-3 border border-line rounded-xl p-3 hover:border-orange hover:bg-page text-left">
            <AvatarChip name={r.full_name} sub={`${r.vehicle_type || 'Vehicle'} · ★ ${r.rating}`} />
            <span className="text-xs font-bold text-orange">Assign →</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ============================================================
// LIVE MAP (network-wide)
// ============================================================
function MapView({ branches, riders }: { branches: Branch[]; riders: RiderCard[] }) {
  const branchPins = branches.slice(0, 8).map((b, i) => ({
    x: 12 + (i * 17) % 80, y: 15 + (i * 29) % 70, name: b.name,
  }));
  const riderPins = riders.filter((r) => r.status !== 'offline').slice(0, 14).map((r, i) => ({
    x: 8 + (i * 13) % 88, y: 10 + (i * 21) % 82, busy: r.status === 'busy', name: r.name,
  }));

  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-base">Network Live Map</h2>
          <p className="text-xs text-muted">Every branch and active rider, at a glance</p>
        </div>
        <Pill status="blue" label={`${riders.filter((r) => r.status !== 'offline').length} riders active`} />
      </div>
      <div className="relative w-full aspect-[16/9] bg-page rounded-xl overflow-hidden border border-line">
        {branchPins.map((b) => <MapPin key={b.name} x={b.x} y={b.y} color="#0F2648" label={b.name} large />)}
        {riderPins.map((r) => <MapPin key={r.name} x={r.x} y={r.y} color={r.busy ? '#2563EB' : '#B7BEC9'} label={r.name.split(' ')[0]} />)}
        {branchPins.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">No branch location data yet.</div>
        )}
      </div>
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-navy" />Branch</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-[#2563EB]" />Rider (on delivery)</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-[#B7BEC9]" />Rider (idle)</span>
      </div>
    </section>
  );
}

function MapPin({ x, y, color, label, large }: { x: number; y: number; color: string; label: string; large?: boolean }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className={large ? 'w-4 h-4 rounded-full border-2 border-white shadow' : 'w-3 h-3 rounded-full border-2 border-white shadow'} style={{ background: color }} />
      <span className="text-[0.62rem] font-semibold text-ink bg-white/90 px-1.5 py-0.5 rounded whitespace-nowrap">{label}</span>
    </div>
  );
}

// ============================================================
// RIDERS
// ============================================================
function RidersView({ riders, onlineRiders, busyRiders, offlineRiders }: {
  riders: RiderCard[]; onlineRiders: number; busyRiders: number; offlineRiders: number;
}) {
  return (
    <>
      <StatStrip items={[
        { num: riders.length, label: 'Total Riders' },
        { num: onlineRiders, label: 'Online / Available' },
        { num: busyRiders, label: 'On Delivery' },
        { num: offlineRiders, label: 'Offline' },
      ]} />
      <section className="bg-white border border-line rounded-2xl p-5">
        <h2 className="font-display font-bold text-base mb-1">Rider Fleet</h2>
        <p className="text-xs text-muted mb-4">Every rider across every branch</p>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {riders.map((r) => {
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
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div><div className="text-muted">Status</div><div className="font-semibold text-ink">{r.status === 'online' ? 'Available' : r.status === 'busy' ? 'On Delivery' : 'Offline'}</div></div>
                  <div><div className="text-muted">Rating</div><div className="font-semibold text-ink">{r.score.toFixed(1)} ★</div></div>
                  <div className="col-span-2"><div className="text-muted">Notes</div><div className="font-semibold text-ink text-[0.72rem]">{r.gps}</div></div>
                </div>
              </div>
            );
          })}
          {riders.length === 0 && <div className="text-sm text-muted col-span-full">No riders found.</div>}
        </div>
      </section>
    </>
  );
}

// ============================================================
// ASSIGNMENT — auto rules + manual override
// ============================================================
function AssignmentView({ rules, onToggle, unassignedOrders, openAssign }: {
  rules: AssignmentRule[]; onToggle: (id: string) => void; unassignedOrders: ApiOrder[]; openAssign: (o: ApiOrder) => void;
}) {
  const typeLabel: Record<AssignmentRule['type'], string> = {
    proximity: 'Proximity-based', load_balance: 'Load balancing', manual_only: 'Manual review', branch_priority: 'Branch priority',
  };
  return (
    <>
      <section className="bg-white border border-line rounded-2xl p-5">
        <h2 className="font-display font-bold text-base mb-1">Automatic Assignment Rules</h2>
        <p className="text-xs text-muted mb-4">Control how new orders get matched to riders across the network</p>
        <div className="flex flex-col gap-3">
          {rules.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-4 border border-line rounded-xl p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-ink">{r.name}</span>
                  <Pill status="blue" label={typeLabel[r.type]} />
                  {r.radiusKm && <Pill status="gray" label={`${r.radiusKm}km radius`} />}
                </div>
                <p className="text-xs text-muted mt-1.5 max-w-xl">{r.description}</p>
              </div>
              <button
                onClick={() => onToggle(r.id)}
                className={`flex-none w-11 h-6 rounded-full relative transition-colors ${r.active ? 'bg-orange' : 'bg-line'}`}
                aria-label={r.active ? 'Disable rule' : 'Enable rule'}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${r.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-base">Manual Assignment Queue</h2>
          <Pill status="amber" label={`${unassignedOrders.length} waiting`} />
        </div>
        <p className="text-xs text-muted mb-4">Orders that auto-assignment couldn't match — assign a rider by hand</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Tracking #</th><th className="py-2">Route</th><th className="py-2">Status</th><th className="py-2">Action</th></tr></thead>
            <tbody>
              {unassignedOrders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 font-mono text-xs">{o.tracking_number}</td>
                  <td className="py-2.5 text-xs text-muted">{o.pickup_address?.city || '—'} → {o.dropoff_address?.city || '—'}</td>
                  <td className="py-2.5"><Pill status={o.status} /></td>
                  <td className="py-2.5">
                    <button onClick={() => openAssign(o)} className="text-xs font-bold text-orange border border-orange/30 rounded-lg px-3 py-1.5 hover:bg-[#FBF3EA]">Assign Manually</button>
                  </td>
                </tr>
              ))}
              {unassignedOrders.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-sm text-muted">Nothing waiting — every order has a rider.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ============================================================
// BRANCHES
// ============================================================
function BranchesView({ branches, zones }: { branches: Branch[]; zones: Zone[] }) {

    const [showCreateBranchForm, setShowCreateBranchForm] = useState(false);

  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name || '—';
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-base">Branches</h2>
          <p className="text-xs text-muted">{branches.length} branches in the network</p>
        </div>
        <button onClick={() => setShowCreateBranchForm((s) => !s)} className="bg-orange hover:bg-orange-light text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5">
          <NavIcon name="plus" size={13} color="#fff" /> Add Branch
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted text-xs border-b border-line">
            <th className="py-2 pr-4">Branch</th><th className="py-2 pr-4">Zone</th><th className="py-2 pr-4">Contact</th>
            <th className="py-2 pr-4">Hours</th><th className="py-2 pr-4">Status</th><th className="py-2">Location</th>
          </tr></thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} className="border-b border-line last:border-0">
                <td className="py-3 pr-4"><div className="font-bold text-ink">{b.name}</div><div className="text-xs text-muted">{b.address}</div></td>
                <td className="py-3 pr-4"><Pill status="blue" label={zoneName(b.zone_id)} /></td>
                <td className="py-3 pr-4 text-xs text-muted">{b.phone}<br />{b.email}</td>
                <td className="py-3 pr-4 text-xs text-muted">{b.opening_time} – {b.closing_time}</td>
                <td className="py-3 pr-4"><Pill status={b.status || 'active'} /></td>
                <td className="py-3">
                  {b.latitude && b.longitude ? (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-orange">Open map →</a>
                  ) : <span className="text-xs text-muted">No coordinates</span>}
                </td>
              </tr>
            ))}
            {branches.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-muted">No branches yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreateBranchForm && (

        <form onSubmit={handleBranchCreate} className='bg-white rounded-card shadow-card p-6 md:p-8 mb-6'>

            <h2 className='font-display font-bold text-lg mb-4'>New Branch</h2>
            <div>
                <Field placeholder='Enter branch name' label='Branch Name' icon={null} />
            </div>

        </form>
      )}
    </section>

    
  );
}

function handleBranchCreate(){

}

// ============================================================
// ZONES
// ============================================================
function ZonesView({ zones, branches }: { zones: Zone[]; branches: Branch[] }) {
  const branchCount = (zoneId: string) => branches.filter((b) => b.zone_id === zoneId).length;
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-base">Service Zones</h2>
          <p className="text-xs text-muted">Coverage areas grouping branches together</p>
        </div>
        <button className="bg-orange hover:bg-orange-light text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5">
          <NavIcon name="plus" size={13} color="#fff" /> Add Zone
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Zone</th><th className="py-2">Description</th><th className="py-2">Branches</th><th className="py-2">Status</th></tr></thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id} className="border-b border-line last:border-0">
              <td className="py-3 font-bold text-ink">{z.name}</td>
              <td className="py-3 text-muted text-xs max-w-sm">{z.description}</td>
              <td className="py-3">{branchCount(z.id)}</td>
              <td className="py-3"><Pill status={z.is_active ? 'green' : 'gray'} label={z.is_active ? 'Active' : 'Inactive'} /></td>
            </tr>
          ))}
          {zones.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-muted">No zones yet.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

// ============================================================
// STAFF & ADMINS
// ============================================================
function StaffView({ users, roleFilter, setRoleFilter, onDelete }: {
  users: AdminUser[]; roleFilter: string; setRoleFilter: (v: string) => void; onDelete: (u: AdminUser) => void;
}) {
  const roles = ['admin', 'super_admin', 'staff', 'rider', 'customer'];
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-base">Staff & Admins</h2>
          <p className="text-xs text-muted">{users.length} accounts{roleFilter ? ` · filtered by ${titleStatus(roleFilter)}` : ''}</p>
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inputCls + ' w-auto'}>
          <option value="">All roles</option>
          {roles.map((r) => <option key={r} value={r}>{titleStatus(r)}</option>)}
        </select>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted text-xs border-b border-line">
          <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Contact</th>
          <th className="py-2 pr-4">Verified</th><th className="py-2 pr-4">Active</th><th className="py-2">Action</th>
        </tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-line last:border-0">
              <td className="py-3 pr-4"><AvatarChip name={u.full_name} /></td>
              <td className="py-3 pr-4"><Pill status="blue" label={titleStatus(u.role)} /></td>
              <td className="py-3 pr-4 text-xs text-muted">{u.phone}<br />{u.email}</td>
              <td className="py-3 pr-4"><Pill status={u.is_verified ? 'green' : 'gray'} label={u.is_verified ? 'Verified' : 'Unverified'} /></td>
              <td className="py-3 pr-4"><Pill status={u.is_active ? 'green' : 'red'} label={u.is_active ? 'Active' : 'Suspended'} /></td>
              <td className="py-3">
                <button onClick={() => onDelete(u)} className="text-xs font-bold text-danger border border-danger/30 rounded-lg px-3 py-1.5 hover:bg-[#FBEAE7] flex items-center gap-1">
                  <NavIcon name="trash" size={12} color="#D8432C" /> Remove
                </button>
              </td>
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-muted">No accounts match this filter.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

function CreateUserModal({ branches, zones, onClose, onCreate }: {
  branches: Branch[]; zones: Zone[]; onClose: () => void; onCreate: (payload: AdminCreateUserPayload) => void;
}) {
  const [form, setForm] = useState<AdminCreateUserPayload>({
    full_name: '', email: '', phone: '', cnic: '', password: '', role: 'staff', designation: '', zone_id: '', branch_id: '',
  });
  function update<K extends keyof AdminCreateUserPayload>(key: K, val: AdminCreateUserPayload[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }
  return (
    <Modal title="Create staff, rider or admin account" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); onCreate(form); }} className="grid sm:grid-cols-2 gap-4">
        <Field icon={null} label="Full name"><input required className={inputCls} value={form.full_name} onChange={(e) => update('full_name', e.target.value)} /></Field>
        <Field icon={null} label="Role">
          <select className={inputCls} value={form.role} onChange={(e) => update('role', e.target.value as AdminCreateUserPayload['role'])}>
            <option value="staff">Staff</option>
            <option value="rider">Rider</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field icon={null} label="Email"><input required type="email" className={inputCls} value={form.email} onChange={(e) => update('email', e.target.value)} /></Field>
        <Field icon={null} label="Phone"><input required className={inputCls} value={form.phone} onChange={(e) => update('phone', e.target.value)} /></Field>
        <Field icon={null} label="CNIC"><input required className={inputCls} value={form.cnic} onChange={(e) => update('cnic', e.target.value)} /></Field>
        <Field icon={null} label="Temporary password"><input required type="password" className={inputCls} value={form.password} onChange={(e) => update('password', e.target.value)} /></Field>
        <Field icon={null} label="Designation"><input className={inputCls} value={form.designation} onChange={(e) => update('designation', e.target.value)} placeholder="e.g. Branch Coordinator" /></Field>
        <Field icon={null} label="Zone">
          <select className={inputCls} value={form.zone_id} onChange={(e) => update('zone_id', e.target.value)}>
            <option value="">Select a zone</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </Field>
        <Field icon={null} label="Branch">
          <select className={inputCls} value={form.branch_id} onChange={(e) => update('branch_id', e.target.value)}>
            <option value="">Select a branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="text-sm font-bold px-4 py-2.5 rounded-lg border border-line text-ink hover:bg-page">Cancel</button>
          <button type="submit" className="text-sm font-bold px-4 py-2.5 rounded-lg bg-orange hover:bg-orange-light text-white">Create Account</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// BUSINESS ACCOUNTS
// ============================================================
function BusinessView({ accounts }: { accounts: BusinessAccount[] }) {
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-base">Business Accounts</h2>
          <p className="text-xs text-muted">Corporate and merchant shipping accounts</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted text-xs border-b border-line">
          <th className="py-2 pr-4">Business</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Monthly Shipments</th>
          <th className="py-2 pr-4">COD</th><th className="py-2 pr-4">City</th><th className="py-2">Status</th>
        </tr></thead>
        <tbody>
          {accounts.map((b) => (
            <tr key={b.id} className="border-b border-line last:border-0">
              <td className="py-3 pr-4"><div className="font-bold text-ink">{b.name}</div><div className="text-xs text-muted">{b.contactPhone}</div></td>
              <td className="py-3 pr-4"><Pill status="blue" label={b.type} /></td>
              <td className="py-3 pr-4">{b.monthlyShipments.toLocaleString()}</td>
              <td className="py-3 pr-4"><Pill status={b.codEnabled ? 'green' : 'gray'} label={b.codEnabled ? 'Enabled' : 'Disabled'} /></td>
              <td className="py-3 pr-4 text-muted">{b.city}</td>
              <td className="py-3"><Pill status={b.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ============================================================
// MESSAGING TEMPLATES
// ============================================================
function MessagingView({ templates, onToggle }: { templates: MessageTemplate[]; onToggle: (id: string) => void }) {
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <h2 className="font-display font-bold text-base mb-1">Automatic Messaging</h2>
      <p className="text-xs text-muted mb-4">Templates sent automatically as an order moves through its lifecycle</p>
      <div className="flex flex-col gap-3">
        {templates.map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-4 border border-line rounded-xl p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-ink">{t.trigger}</span>
                <Pill status="blue" label={t.channel} />
              </div>
              <p className="text-xs text-muted mt-1.5 max-w-xl font-mono">{t.body}</p>
            </div>
            <button onClick={() => onToggle(t.id)} className={`flex-none w-11 h-6 rounded-full relative transition-colors ${t.active ? 'bg-orange' : 'bg-line'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${t.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// REPORTS
// ============================================================
function ReportsView({ analytics, riders }: { analytics?: AdminAnalytics; riders: RiderCard[] }) {
  const topRiders = [...riders].sort((a, b) => b.score - a.score).slice(0, 6);
  const statusEntries = analytics ? Object.entries(analytics.status_counts) : [];
  const channelEntries = analytics ? Object.entries(analytics.channel_counts) : [];
  const maxStatus = Math.max(1, ...statusEntries.map(([, v]) => v));

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Orders by Status</h2>
          <p className="text-xs text-muted mb-4">Current distribution, network-wide</p>
          <div className="flex flex-col gap-2.5">
            {statusEntries.map(([status, count]) => (
              <div key={status}>
                <div className="flex justify-between text-xs font-semibold text-ink mb-1"><span>{titleStatus(status)}</span><span>{count}</span></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden"><div className="h-full bg-orange" style={{ width: `${(count / maxStatus) * 100}%` }} /></div>
              </div>
            ))}
            {statusEntries.length === 0 && <div className="text-sm text-muted">No data yet.</div>}
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Orders by Booking Channel</h2>
          <p className="text-xs text-muted mb-4">Where orders are coming from</p>
          <StatStrip items={channelEntries.map(([channel, count]) => ({ num: count, label: titleStatus(channel) }))} />
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Top Riders (by rating)</h2>
          <table className="w-full text-sm mt-3">
            <thead><tr className="text-left text-muted text-xs border-b border-line"><th className="py-2">Rider</th><th className="py-2">Rating</th><th className="py-2">Success</th></tr></thead>
            <tbody>
              {topRiders.map((r) => (
                <tr key={r.name} className="border-b border-line last:border-0">
                  <td className="py-2.5"><AvatarChip name={r.name} /></td>
                  <td className="py-2.5">{r.score.toFixed(1)} ★</td>
                  <td className="py-2.5"><Pill status={r.success >= 90 ? 'green' : 'amber'} label={`${r.success}%`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-4">Week-over-Week Comparison</h2>
          <div className="flex flex-col gap-4">
            {NETWORK_COMPARISON.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs font-semibold text-ink mb-1"><span>{c.label}</span><span>{c.thisWeek}% vs {c.lastWeek}%</span></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden mb-1"><div className="h-full bg-orange" style={{ width: `${c.thisWeek}%` }} /></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden"><div className="h-full bg-[#B7BEC9]" style={{ width: `${c.lastWeek}%` }} /></div>
              </div>
            ))}
            <div className="text-xs text-muted mt-1"><span className="text-orange font-bold">■</span> This week &nbsp; <span className="text-[#B7BEC9] font-bold">■</span> Last week</div>
          </div>
        </section>
      </div>
    </>
  );
}

// ============================================================
// ALERTS
// ============================================================
function AlertsView({ alerts }: { alerts: AdminAlert[] }) {
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <h2 className="font-display font-bold text-base mb-1">Alerts & Notifications</h2>
      <p className="text-xs text-muted mb-4">Everything flagged for super admin review</p>
      <div className="flex flex-col gap-2.5">
        {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
      </div>
    </section>
  );
}

function AlertCard({ alert }: { alert: AdminAlert }) {
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
// SETTINGS
// ============================================================
function SettingsView({ toast }: { toast: (msg: string) => void }) {
  const [currency, setCurrency] = useState('PKR');
  const [codLimit, setCodLimit] = useState('15000');
  const [autoAssign, setAutoAssign] = useState(true);
  const [assignRadius, setAssignRadius] = useState('3');

  return (
    <section className="bg-white border border-line rounded-2xl p-5 max-w-2xl">
      <h2 className="font-display font-bold text-base mb-1">Network Defaults</h2>
      <p className="text-xs text-muted mb-5">These apply to every branch unless a branch overrides them</p>
      <form onSubmit={(e) => { e.preventDefault(); toast('Settings saved.'); }} className="flex flex-col gap-4">
        <Field icon={null} label="Default currency">
          <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="PKR">PKR — Pakistani Rupee</option>
            <option value="USD">USD — US Dollar</option>
          </select>
        </Field>
        <Field icon={null} label="Manual-review COD threshold">
          <input className={inputCls} type="number" value={codLimit} onChange={(e) => setCodLimit(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between border border-line rounded-xl p-4">
          <div>
            <div className="font-bold text-sm text-ink">Automatic rider assignment</div>
            <div className="text-xs text-muted mt-0.5">When on, new orders are matched to riders automatically using the active assignment rules.</div>
          </div>
          <button type="button" onClick={() => setAutoAssign((v) => !v)} className={`flex-none w-11 h-6 rounded-full relative transition-colors ${autoAssign ? 'bg-orange' : 'bg-line'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoAssign ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <Field icon={null} label="Default assignment search radius (km)">
          <input className={inputCls} type="number" value={assignRadius} onChange={(e) => setAssignRadius(e.target.value)} disabled={!autoAssign} />
        </Field>
        <div className="flex justify-end mt-2">
          <button type="submit" className="text-sm font-bold px-5 py-2.5 rounded-lg bg-orange hover:bg-orange-light text-white">Save Settings</button>
        </div>
      </form>
    </section>
  );
}