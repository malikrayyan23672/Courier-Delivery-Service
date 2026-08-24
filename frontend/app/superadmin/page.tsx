'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/context/AuthContext';
import { Field } from './components';
import { NotificationBell } from '@/components/NotificationBell';
import { AnnouncementsPanel } from '@/components/AnnouncementsPanel';
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
  AddCityPayload,
  addCity,
  deleteZoneByAdmin,
  listMyNotifications,
  NotificationItem,
  listActivityFeed,
  ActivityItem as AuditActivityItem,
  listAssignmentRules,
  updateAssignmentRule,
  AssignmentRule,
  listMessageTemplates,
  updateMessageTemplate,
  MessageTemplate,
  listSellersAdmin,
  approveSeller,
  rejectSeller,
  deactivateSeller,
  activateSeller,
  AdminSeller,
  getNetworkSettings,
  updateNetworkSettings,
  NetworkSettings,
  createBranch,
  updateBranch,
  resetUserPassword,
  getRiderLeaderboard,
  RiderLeaderboardRow,
  Hub,
  HubInput,
  listHubs,
  createHub,
  updateHub,
  Headquarter,
  listHeadquarters,
  LocalOffice,
  LocalOfficeInput,
  listLocalOffices,
  createLocalOffice,
  updateLocalOffice,
  deleteHub,
  EditCityPayload,
  editCity,
  deleteBranch,
} from '@/lib/api';
import {
  Pill, AvatarChip, KpiCard, StatStrip, Toasts, NavIcon, NavBadge, Modal, inputCls,
} from './components';
import { RequestsView } from '@/components/ops/RequestsView';
import { BusNetworkTab, DiscountsTab, AdminOrderDetailModal } from '@/app/admin/components';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Select, SelectItem } from '@/components/ui/select';
import { SelectField } from '@/components/Select';
import { error } from 'console';

type View =
  | 'overview' | 'orders' | 'map'
  | 'riders' | 'assignment' | 'requests' | 'leaderboard'
  | 'branches' | 'zones' | 'hubops' | 'bus'
  | 'staff' | 'business'
  | 'messaging'
  | 'discounts'
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
    { view: 'leaderboard', label: 'Leaderboard', icon: 'check' },
    { view: 'assignment', label: 'Assignment Rules', icon: 'target' },
    { view: 'requests', label: 'Rider Requests', icon: 'alert' },
  ]},
  { label: 'Network', items: [
    { view: 'hubops', label: 'Hubs', icon: 'building' },
    { view: 'branches', label: 'Branches & Offices', icon: 'building' },
    { view: 'zones', label: 'Service Zones', icon: 'zone' },
    { view: 'bus', label: 'Bus Network', icon: 'truck' },
  ]},
  { label: 'Accounts', items: [
    { view: 'staff', label: 'Staff & Admins', icon: 'staff' },
    { view: 'business', label: 'Business Accounts', icon: 'business' },
  ]},
  { label: 'Engagement', items: [
    { view: 'messaging', label: 'Messaging Templates', icon: 'message' },
    { view: 'discounts', label: 'Discounts', icon: 'dollar' },
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
  requests: { title: 'Rider Requests', sub: 'Availability changes, parcel unlocks and support tickets across every branch' },
  leaderboard: { title: 'Rider Leaderboard', sub: 'Full network ranking by deliveries, earnings and success rate' },
  hubops: { title: 'Hub', sub: 'Manage every branch in the network' },
  branches: { title: 'Branches & Local Offices', sub: 'Sorting hubs and guest booking counters within each branch' },
  zones: { title: 'Service Zones', sub: 'Coverage areas and delivery capabilities' },
  bus: { title: 'Bus Network', sub: 'Operators, corridors and manifests across every branch' },
  staff: { title: 'Staff & Admins', sub: 'Every internal account and its role' },
  business: { title: 'Business Accounts', sub: 'Corporate and merchant shipping accounts' },
  messaging: { title: 'Messaging Templates', sub: 'Automatic SMS, WhatsApp, email and push notifications' },
  discounts: { title: 'Discounts', sub: 'Signup offers and promo codes' },
  reports: { title: 'Reports & Analytics', sub: 'Network performance trends' },
  alerts: { title: 'Alerts & Notifications', sub: 'Everything flagged for super admin review' },
  settings: { title: 'System Settings', sub: 'Defaults that apply across the whole network' },
};

function titleStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleDateString();
}

function notificationToAlert(n: NotificationItem): { sev: 'high' | 'medium' | 'low'; title: string; msg: string; time: string } {
  const sev: 'high' | 'medium' | 'low' = n.type === 'error' ? 'high' : n.type === 'warning' ? 'medium' : 'low';
  return { sev, title: n.title, msg: n.message, time: relativeTime(n.created_at) };
}

function activityText(a: AuditActivityItem): string {
  return a.details || `${a.user ?? 'System'} ${a.action.replace(/_/g, ' ')}${a.entity_type ? ` — ${a.entity_type}` : ''}`;
}

function activityIcon(a: AuditActivityItem): { icon: string; color: string } {
  const key = `${a.action} ${a.entity_type}`.toLowerCase();
  if (key.includes('deliver')) return { icon: 'check', color: '#1E8E5A' };
  if (key.includes('branch')) return { icon: 'building', color: '#2563EB' };
  if (key.includes('rider')) return { icon: 'riders', color: '#1E8E5A' };
  if (key.includes('business') || key.includes('seller')) return { icon: 'business', color: '#F2A93B' };
  if (key.includes('rule') || key.includes('zone')) return { icon: 'target', color: '#E6350F' };
  if (key.includes('message') || key.includes('template') || key.includes('notification')) return { icon: 'message', color: '#1D3C8F' };
  if (key.includes('fail') || key.includes('dispute') || key.includes('reject')) return { icon: 'alert', color: '#E6350F' };
  return { icon: 'box', color: '#2563EB' };
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
    <RoleGuard allowedRoles={['super_admin']}>
      <AdminDashboardContent />
    </RoleGuard>
  );
}

function AdminDashboardContent() {

  const [view, setView] = useState<View>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  const [analytics, setAnalytics] = useState<AdminAnalytics>();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [adminRiders, setAdminRiders] = useState<AdminRider[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [branchList, setBranchList] = useState<Branch[]>([]);
  const [localOffices, setLocalOffices] = useState<LocalOffice[]>([]);
  const [headquarters, setHeadquarters] = useState<Headquarter[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  const [assignmentRules, setAssignmentRules] = useState<AssignmentRule[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [businessAccounts, setBusinessAccounts] = useState<AdminSeller[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activity, setActivity] = useState<AuditActivityItem[]>([]);

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  const [assignModalOrder, setAssignModalOrder] = useState<ApiOrder | null>(null);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);


  const {token, setToken} = useAuth();

  const router = useRouter()

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
      listHubs(token),
      listZones(token),
      listStaffAndRiders(token),
      listAssignmentRules(token),
      listMessageTemplates(token),
      listSellersAdmin(token),
      listBranches(token),
      listLocalOffices(token),
      listHeadquarters(token),
    ])
      .then(([a, o, r, h, z, u, rules, templates, sellers, bl, lo, hq]) => {
        setAnalytics(a);
        setOrders(o);
        setAdminRiders(r);
        setHubs(h);
        setZones(z);
        setUsers(u);
        setAssignmentRules(rules);
        setMessageTemplates(templates);
        setBusinessAccounts(sellers);
        setBranchList(bl);
        setLocalOffices(lo);
        setHeadquarters(hq);
      })
      .catch((err) => {
        setSyncError(err instanceof ApiError ? err.message : 'Could not sync network data with backend.');
      })
      .finally(() => setSyncing(false));

    listMyNotifications(token).then((d) => setNotifications(d.notifications)).catch(() => {});
    listActivityFeed(token).then(setActivity).catch(() => {});
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

  async function handleDeleteZone(z: Zone){
    if(!token){
      return;
    }

    if(!confirm(`Remove ${z.name} zone? This can't be undone.`)){
      return;
    }

    try{
      await deleteZoneByAdmin(z.id, token)
      toast(`${z.name} zone has been removed`);
      setZones((prev) => prev.filter((x) => x.id !== z.id))
    }catch(err){
      toast(err instanceof ApiError ? err.message : "Could not remove zone.");
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

  async function handleResetPassword(u: AdminUser) {
    if (!token) return;
    if (!confirm(`Reset ${u.full_name}'s password? Their current password stops working immediately.`)) return;
    try {
      const result = await resetUserPassword(u.id, token);
      window.alert(`New temporary password for ${result.full_name}:\n\n${result.temporary_password}\n\nShare this with them directly - it won't be shown again.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not reset password.');
    }
  }

  async function toggleRule(id: string) {
    if (!token) return;
    const rule = assignmentRules.find((r) => r.id === id);
    if (!rule) return;
    try {
      const updated = await updateAssignmentRule(id, { active: !rule.active }, token);
      setAssignmentRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update rule.');
    }
  }

  async function toggleTemplate(id: string) {
    if (!token) return;
    const template = messageTemplates.find((t) => t.id === id);
    if (!template) return;
    try {
      const updated = await updateMessageTemplate(id, { active: !template.active }, token);
      setMessageTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update template.');
    }
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

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  const filteredUsers = useMemo(() => users.filter((u) => !userRoleFilter || u.role === userRoleFilter), [users, userRoleFilter]);

  return (
    <div className="min-h-screen flex bg-page">
      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-navy text-white flex flex-col p-4 gap-1 overflow-y-auto transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

        <a href="/">
        <div className="flex items-center gap-2.5 mb-6 px-1">
          <img src="icon.jpeg" alt="" width={45} height={45} /> 
          
          <div>
            <div className="font-display text-lg font-extrabold leading-none">RAFTAAR<span className="text-[#db2203]">EXPRESS</span></div>
            <div className="text-[0.6rem] tracking-[0.2em] text-white/50 font-semibold mt-0.5">SUPER ADMIN</div>
          </div>
        </div>
        </a>

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
                {item.view === 'alerts' && notifications.filter((n) => !n.is_read).length > 0 && (
                  <NavBadge n={notifications.filter((n) => !n.is_read).length} danger />
                )}
              </button>
            ))}
          </div>
        ))}

        <div className="mt-auto pt-4 border-t border-white/10 text-xs text-white/50">
          {hubs.length} hubs · {zones.length} zones
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
            <div className="text-xs text-muted-foreground truncate">{PAGE_META[view].sub}</div>
          </div>
          <NotificationBell token={token!} className="text-ink" />

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
              <DropdownMenuLabel>Super Admin</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => switchView('settings')}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* {view === 'zones' && (
            <button onClick={() => setShowAddNewZone(true)} className="hidden sm:flex items-center gap-1.5 bg-[#db2203] hover:bg-[#db2203]-light text-white font-bold text-sm px-4 py-2.5 rounded-[10px] transition-colors whitespace-nowrap">
              <NavIcon name="plus" size={14} color="#fff" /> Add City
            </button>
          )} */}
          {view === 'staff' && (
            <button onClick={() => setShowCreateUser(true)} className="hidden sm:flex items-center gap-1.5 bg-[#db2203] hover:bg-[#db2203]-light text-white font-bold text-sm px-4 py-2.5 rounded-[10px] transition-colors whitespace-nowrap">
              <NavIcon name="plus" size={14} color="#fff" /> New Account
            </button>
          )}
        </div>

        <div className="p-5 md:p-8 flex flex-col gap-6">
          {(syncing || syncError) && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${syncError ? 'bg-[#FBEAE7] border-danger/30 text-[#db2203]' : 'bg-[#EAF1FC] border-[#2563EB]/20 text-navy'}`}>
              {syncError || 'Syncing network data with backend...'}
            </div>
          )}

          {view === 'overview' && (
            <OverviewView analytics={analytics} hubs={hubs} zones={zones} onlineRiders={onlineRiders}
              busyRiders={busyRiders} unassignedOrders={unassignedOrders.length} switchView={switchView} activity={activity} />
          )}

          {view === 'orders' && (
            <OrdersView orders={filteredOrders} total={orders.length} search={orderSearch} setSearch={setOrderSearch}
              statusFilter={orderStatusFilter} setStatusFilter={setOrderStatusFilter}
              onAssign={(o) => setAssignModalOrder(o)} onView={(o) => setViewingOrderId(o.id)} />
          )}

          {view === 'map' && <MapView hubs={hubs} riders={riders} />}

          {view === 'riders' && (
            <RidersView riders={riders} onlineRiders={onlineRiders} busyRiders={busyRiders} offlineRiders={offlineRiders} />
          )}

          {view === 'assignment' && (
            <AssignmentView rules={assignmentRules} onToggle={toggleRule} unassignedOrders={unassignedOrders}
              openAssign={(o) => setAssignModalOrder(o)} />
          )}

          {view === 'requests' && <RequestsView />}

          {view === 'leaderboard' && <LeaderboardView token={token!} toast={toast} />}

          {view === 'bus' && <BusNetworkTab token={token!} />}

          {view === 'discounts' && <DiscountsTab token={token!} />}

          {view === 'hubops' && (
            <HubsView hubs={hubs} zones={zones} headquarters={headquarters} token={token!} toast={toast} setHubs={setHubs} />
          )}

          {view === 'zones' && <ZonesView zones={zones} hubs={hubs} onDelete={handleDeleteZone} />}

          {view === 'branches' && <BranchesAndOfficesView hubs={hubs} token={token!} toast={toast} />}

          {view === 'staff' && (
            <StaffView users={filteredUsers} roleFilter={userRoleFilter} setRoleFilter={setUserRoleFilter}
              onDelete={handleDeleteUser} onResetPassword={handleResetPassword} />
          )}

          {view === 'business' && <BusinessView accounts={businessAccounts} token={token!} toast={toast} onChanged={setBusinessAccounts} />}

          {view === 'messaging' && <MessagingView templates={messageTemplates} onToggle={toggleTemplate} />}

          {view === 'reports' && <ReportsView analytics={analytics} riders={riders} />}

          {view === 'alerts' && <AlertsView notifications={notifications} />}

          {view === 'settings' && <SettingsView toast={toast} token={token!} />}
        </div>
      </div>

      {assignModalOrder && (
        <AssignRiderModal order={assignModalOrder} riders={adminRiders} onClose={() => setAssignModalOrder(null)} onAssign={handleAssignRider} />
      )}

      {viewingOrderId && (
        <AdminOrderDetailModal
          orderId={viewingOrderId}
          token={token!}
          onClose={() => setViewingOrderId(null)}
          onChanged={(updated) => setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status } : o)))}
        />
      )}

      

      {showCreateUser && (
        <CreateUserModal hubs={hubs} branches={branchList} localOffices={localOffices} zones={zones} onClose={() => setShowCreateUser(false)} onCreate={handleCreateUser} />
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}

// ============================================================
// OVERVIEW
// ============================================================
function OverviewView({ analytics, hubs, zones, onlineRiders, busyRiders, unassignedOrders, switchView, activity }: {
  analytics?: AdminAnalytics; hubs: Hub[]; zones: Zone[]; onlineRiders: number; busyRiders: number;
  unassignedOrders: number; switchView: (v: View) => void; activity: AuditActivityItem[];
}) {
  const kpis = [
    { icon: 'box', bg: '#2563EB', label: 'Total Orders', num: analytics?.total_orders ?? '—', trend: 'All channels, all time', trendColor: '#8A94A6' },
    { icon: 'dollar', bg: '#1E8E5A', label: 'Total Revenue', num: analytics ? `Rs ${analytics.total_revenue.toLocaleString()}` : '—', trend: 'Network-wide', trendColor: '#1E8E5A' },
    { icon: 'clock', bg: '#F2A93B', label: 'Unassigned Orders', num: unassignedOrders, trend: 'Needs a rider', trendColor: '#B8710A' },
    { icon: 'riders', bg: '#1E8E5A', label: 'Riders Online', num: onlineRiders, trend: 'Ready for dispatch', trendColor: '#1E8E5A' },
    { icon: 'riders', bg: '#F2A93B', label: 'Riders on Delivery', num: busyRiders, trend: 'Active routes', trendColor: '#B8710A' },
    { icon: 'building', bg: '#1D3C8F', label: 'Hubs', num: hubs.length, trend: 'Across the network', trendColor: '#8A94A6' },
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
          <p className="text-xs text-muted-foreground mb-4">Network-wide order volume</p>
          {week.length === 0 ? (
            <div className="text-sm text-muted-foreground">No data yet.</div>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {week.map((w) => (
                <div key={w.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs font-semibold text-ink">{w.orders}</span>
                  <div className="w-full bg-[#db2203] rounded-t" style={{ height: `${(w.orders / maxOrders) * 100}%` }} />
                  <span className="text-xs text-muted-foreground">{new Date(w.date).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Recent Network Activity</h2>
          <p className="text-xs text-muted-foreground mb-4">Latest changes across the platform</p>
          <div className="flex flex-col gap-3">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            ) : (
              activity.slice(0, 8).map((a) => {
                const { icon, color } = activityIcon(a);
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-none text-white" style={{ background: color }}>
                      <NavIcon name={icon} size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink">{activityText(a)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{relativeTime(a.created_at)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="bg-white border border-line rounded-2xl p-5">
        <h2 className="font-display font-bold text-base mb-1">Quick Actions</h2>
        <p className="text-xs text-muted-foreground mb-4">Jump to common super admin tasks</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {quickActions.map((q) => (
            <button key={q.label} onClick={() => switchView(q.goto)}
              className="flex flex-col items-center gap-2 border border-line rounded-xl p-4 text-xs font-semibold text-ink hover:border-orange hover:bg-page transition-colors text-center">
              <NavIcon name={q.icon} size={18} color="#0B2472" />
              {q.label}
            </button>
          ))}
        </div>
      </section>

      {analytics?.top_riders && analytics.top_riders.length > 0 && (
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Top Performing Riders</h2>
          <p className="text-xs text-muted-foreground mb-3">By completed deliveries, network-wide</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground text-xs border-b border-line"><th className="py-2">Rider</th><th className="py-2">Deliveries</th><th className="py-2">Earnings</th></tr></thead>
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
function OrdersView({ orders, total, search, setSearch, statusFilter, setStatusFilter, onAssign, onView }: {
  orders: ApiOrder[]; total: number; search: string; setSearch: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void; onAssign: (o: ApiOrder) => void;
  onView: (o: ApiOrder) => void;
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
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
            <tr className="border-b border-line text-left text-muted-foreground text-xs">
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
                <td className="py-3 pr-4 text-xs text-muted-foreground">{o.pickup_address?.city || '—'} → {o.dropoff_address?.city || '—'}</td>
                <td className="py-3 pr-4"><Pill status="gray" label={titleStatus(o.booking_channel || 'app')} /></td>
                <td className="py-3 pr-4">{o.final_price ?? o.estimated_price ?? '—'}</td>
                <td className="py-3 pr-4">{o.rider_accepted ? <Pill status="green" label="Assigned" /> : <Pill status="amber" label="Unassigned" />}</td>
                <td className="py-3 pr-4"><Pill status={o.status} /></td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onView(o)} className="text-xs font-bold text-navy border border-line rounded-lg px-3 py-1.5 hover:bg-page">View</button>
                    {!o.rider_accepted && o.status !== 'cancelled' && o.status !== 'delivered' && (
                      <button onClick={() => onAssign(o)} className="text-xs font-bold text-[#db2203] border border-orange/30 rounded-lg px-3 py-1.5 hover:bg-[#FBF3EA]">Assign Rider</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No orders match this filter.</td></tr>
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
      <p className="text-sm text-muted-foreground mb-4">Choose an available rider to send this order to. They'll get a notification to accept or decline.</p>
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
        {available.length === 0 && <div className="text-sm text-muted-foreground">No riders are currently available.</div>}
        {available.map((r) => (
          <button key={r.rider_id} onClick={() => onAssign(r.rider_id)}
            className="flex items-center justify-between gap-3 border border-line rounded-xl p-3 hover:border-orange hover:bg-page text-left">
            <AvatarChip name={r.full_name} sub={`${r.vehicle_type || 'Vehicle'} · ★ ${r.rating}`} />
            <span className="text-xs font-bold text-[#db2203]">Assign →</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ============================================================
// LIVE MAP (network-wide)
// ============================================================
function MapView({ hubs, riders }: { hubs: Hub[]; riders: RiderCard[] }) {
  const branchPins = hubs.slice(0, 8).map((b, i) => ({
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
          <p className="text-xs text-muted-foreground">Every branch and active rider, at a glance</p>
        </div>
        <Pill status="blue" label={`${riders.filter((r) => r.status !== 'offline').length} riders active`} />
      </div>
      <div className="relative w-full aspect-[16/9] bg-page rounded-xl overflow-hidden border border-line">
        {branchPins.map((b) => <MapPin key={b.name} x={b.x} y={b.y} color="#0B2472" label={b.name} large />)}
        {riderPins.map((r) => <MapPin key={r.name} x={r.x} y={r.y} color={r.busy ? '#2563EB' : '#B7BEC9'} label={r.name.split(' ')[0]} />)}
        {branchPins.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No branch location data yet.</div>
        )}
      </div>
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block bg-navy" />Hub</span>
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
        <p className="text-xs text-muted-foreground mb-4">Every rider across every branch</p>
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
                    <div className="text-xs text-muted-foreground">{r.vehicle}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div><div className="text-muted-foreground">Status</div><div className="font-semibold text-ink">{r.status === 'online' ? 'Available' : r.status === 'busy' ? 'On Delivery' : 'Offline'}</div></div>
                  <div><div className="text-muted-foreground">Rating</div><div className="font-semibold text-ink">{r.score.toFixed(1)} ★</div></div>
                  <div className="col-span-2"><div className="text-muted-foreground">Notes</div><div className="font-semibold text-ink text-[0.72rem]">{r.gps}</div></div>
                </div>
              </div>
            );
          })}
          {riders.length === 0 && <div className="text-sm text-muted-foreground col-span-full">No riders found.</div>}
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
  const typeLabel: Record<AssignmentRule['rule_type'], string> = {
    proximity: 'Proximity-based', load_balance: 'Load balancing', manual_only: 'Manual review', branch_priority: 'Branch priority',
  };
  return (
    <>
      <section className="bg-white border border-line rounded-2xl p-5">
        <h2 className="font-display font-bold text-base mb-1">Automatic Assignment Rules</h2>
        <p className="text-xs text-muted-foreground mb-4">Control how new orders get matched to riders across the network</p>
        <div className="flex flex-col gap-3">
          {rules.length === 0 && <p className="text-sm text-muted-foreground">No assignment rules configured yet.</p>}
          {rules.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-4 border border-line rounded-xl p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-ink">{r.name}</span>
                  <Pill status="blue" label={typeLabel[r.rule_type] ?? r.rule_type} />
                  {r.radius_km && <Pill status="gray" label={`${r.radius_km}km radius`} />}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-xl">{r.description}</p>
              </div>
              <button
                onClick={() => onToggle(r.id)}
                className={`flex-none w-11 h-6 rounded-full relative transition-colors ${r.active ? 'bg-[#db2203]' : 'bg-line'}`}
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
        <p className="text-xs text-muted-foreground mb-4">Orders that auto-assignment couldn't match — assign a rider by hand</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground text-xs border-b border-line"><th className="py-2">Tracking #</th><th className="py-2">Route</th><th className="py-2">Status</th><th className="py-2">Action</th></tr></thead>
            <tbody>
              {unassignedOrders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 font-mono text-xs">{o.tracking_number}</td>
                  <td className="py-2.5 text-xs text-muted-foreground">{o.pickup_address?.city || '—'} → {o.dropoff_address?.city || '—'}</td>
                  <td className="py-2.5"><Pill status={o.status} /></td>
                  <td className="py-2.5">
                    <button onClick={() => openAssign(o)} className="text-xs font-bold text-[#db2203] border border-orange/30 rounded-lg px-3 py-1.5 hover:bg-[#FBF3EA]">Assign Manually</button>
                  </td>
                </tr>
              ))}
              {unassignedOrders.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Nothing waiting — every order has a rider.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

interface HubFormState {
  name: string;
  address: string;
  email: string;
  opening_time: string;
  closing_time: string;
  phone: string;
  status: 'active' | 'inactive';
  zone_id: string;
  headquarter_id: string;
  latitude: string;
  longitude: string;
}

interface BranchFormState{

  name: string;
  hub_id: string;
  address: string;
  phone: string;
}

const INITIAL_HUB_FORM: HubFormState = {
  name: '',
  address: '',
  email: '',
  opening_time: '',
  closing_time: '',
  phone: '',
  status: 'active',
  zone_id: '',
  headquarter_id: '',
  latitude: '',
  longitude: '',
};


function hubToForm(h: Hub): HubFormState {
  return {
    name: h.name,
    address: h.address || '',
    email: h.email || '',
    opening_time: h.opening_time || '',
    closing_time: h.closing_time || '',
    phone: h.phone || '',
    status: (h.status as 'active' | 'inactive') || 'active',
    zone_id: h.zone_id || '',
    headquarter_id: h.headquarter_id || '',
    latitude: h.latitude || '',
    longitude: h.longitude || '',
  };
}

function branchToForm(b: Branch): BranchFormState {
  return {
    name: b.name,
    address: b.address || '',
    phone: b.phone || '',
    // status: (b.status as 'active' | 'inactive') || 'active',
    hub_id: b.hub_id || '',
    // headquarter_id: b.headquarter_id || '',
    // latitude: b.latitude || '',
    // longitude: b.longitude || '',
  };
}

// ============================================================
// HUBS (city-level main offices)
// ============================================================
function HubsView({ hubs, zones, headquarters, token, toast, setHubs }: {
  hubs: Hub[]; zones: Zone[]; headquarters: Headquarter[]; token: string; toast: (msg: string) => void;
  setHubs: React.Dispatch<React.SetStateAction<Hub[]>>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<HubFormState>(INITIAL_HUB_FORM);
  const [saving, setSaving] = useState(false);

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name || '—';
  const hqName = (id: string | null) => headquarters.find((q) => q.id === id)?.name || '—';

  function openCreateForm() {
    setEditingId(null);
    setForm(INITIAL_HUB_FORM);
    setShowForm(true);
  }

  function openEditForm(h: Hub) {
    setEditingId(h.id);
    setForm(hubToForm(h));
    setShowForm(true);
  }

  async function handleDelete(hub_id: string){

    if(!window.confirm('Do you realy want to delete hub')){
      return
    }

    try{

      await deleteHub(hub_id,token)

    }catch(err){
      setHubs((prev) => prev.filter((hub) => hub.id !== hub_id))

    }

  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast('Hub name is required.'); return; }
    const payload = {
      name: form.name.trim(),
      address: form.address || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      opening_time: form.opening_time || undefined,
      closing_time: form.closing_time || undefined,
      latitude: form.latitude || undefined,
      longitude: form.longitude || undefined,
      zone_id: form.zone_id || undefined,
      headquarter_id: form.headquarter_id || undefined,
      status: form.status,
    };
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateHub(editingId, payload, token);
        setHubs((prev) => prev.map((h) => (h.id === editingId ? updated : h)));
        toast('Hub updated.');
      } else {
        const created = await createHub(payload, token);
        setHubs((prev) => [...prev, created]);
        toast('Hub created.');
      }
      setShowForm(false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save hub.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(h: Hub) {
    const newStatus = h.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await updateHub(h.id, { status: newStatus }, token);
      setHubs((prev) => prev.map((x) => (x.id === h.id ? updated : x)));
      toast(`${h.name} marked ${newStatus}.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update hub status.');
    }
  }

  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-base">Hubs</h2>
          <p className="text-xs text-muted-foreground">{hubs.length} city hubs in the network</p>
        </div>
        <button onClick={showForm ? () => setShowForm(false) : openCreateForm} className="bg-[#db2203] hover:bg-[#db2203]-light text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5">
          <NavIcon name="plus" size={13} color="#fff" /> {showForm ? 'Cancel' : 'Add Hub'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-page rounded-xl p-5 mb-5">
          <h3 className="font-display font-bold text-sm mb-3">{editingId ? 'Edit Hub' : 'New Hub'}</h3>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Hub Name">
              <input type="text" required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Zone">
              <select className={inputCls} value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })}>
                <option value="">No zone</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </Field>
            <Field label="Headquarter">
              <select className={inputCls} value={form.headquarter_id} onChange={(e) => setForm({ ...form, headquarter_id: e.target.value })}>
                <option value="">No headquarter</option>
                {headquarters.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
            </Field>
            <Field label="Address">
              <input type="text" className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input type="text" className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Opening Time">
              <input type="text" placeholder="09:00 AM" className={inputCls} value={form.opening_time} onChange={(e) => setForm({ ...form, opening_time: e.target.value })} />
            </Field>
            <Field label="Closing Time">
              <input type="text" placeholder="09:00 PM" className={inputCls} value={form.closing_time} onChange={(e) => setForm({ ...form, closing_time: e.target.value })} />
            </Field>
            <Field label="Latitude">
              <input type="text" className={inputCls} value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </Field>
            <Field label="Longitude">
              <input type="text" className={inputCls} value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" disabled={saving} className="text-sm font-bold px-5 py-2.5 rounded-lg bg-[#db2203] hover:bg-[#db2203]-light text-white disabled:opacity-60">
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Hub'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground text-xs border-b border-line">
            <th className="py-2 pr-4">Hub</th><th className="py-2 pr-4">Zone</th><th className="py-2 pr-4">Headquarter</th><th className="py-2 pr-4">Admin</th><th className="py-2 pr-4">Contact</th>
            <th className="py-2 pr-4">Hours</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Location</th><th className="py-2">Actions</th>
          </tr></thead>
          <tbody>
            {hubs.map((h) => (
              <tr key={h.id} className="border-b border-line last:border-0">
                <td className="py-3 pr-4"><div className="font-bold text-ink">{h.name}</div><div className="text-xs text-muted-foreground">{h.address}</div></td>
                <td className="py-3 pr-4"><Pill status="blue" label={zoneName(h.zone_id)} /></td>
                <td className="py-3 pr-4"><Pill status="gray" label={hqName(h.headquarter_id)} /></td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{h.admin_name || 'Unassigned'}</td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{h.phone}<br />{h.email}</td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{h.opening_time} – {h.closing_time}</td>
                <td className="py-3 pr-4"><Pill status={h.status || 'active'} /></td>
                <td className="py-3 pr-4">
                  {h.latitude && h.longitude ? (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${h.latitude},${h.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#db2203]">Open map →</a>
                  ) : <span className="text-xs text-muted-foreground">No coordinates</span>}
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => openEditForm(h)} className="text-xs font-bold text-navy hover:underline">Edit</button>
                    <button onClick={() => toggleStatus(h)} className="text-xs font-bold text-muted-foreground hover:underline">
                      {h.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDelete(h.id)} className="text-xs font-bold text-danger hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {hubs.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">No hubs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================
// BRANCHES & LOCAL OFFICES (sub-locations under a hub)
// ============================================================
const INITIAL_BRANCH_FORM = { name: '', hub_id: '', address: '', phone: '' };
// branch_id here links a local office to its parent sorting Branch.
const INITIAL_OFFICE_FORM = { name: '', branch_id: '', address: '', phone: '' };

function BranchesAndOfficesView({ hubs, token, toast }: { hubs: Hub[]; token: string; toast: (msg: string) => void }) {
  const [tab, setTab] = useState<'branches' | 'offices'>('branches');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [localOffices, setLocalOffices] = useState<LocalOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [showOfficeForm, setShowOfficeForm] = useState(false);
  const [branchForm, setBranchForm] = useState(INITIAL_BRANCH_FORM);
  const [officeForm, setOfficeForm] = useState(INITIAL_OFFICE_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string>('')

  useEffect(() => {
    setLoading(true);
    Promise.all([listBranches(token), listLocalOffices(token)])
      .then(([b, o]) => { setBranches(b); setLocalOffices(o); })
      .catch((err) => toast(err instanceof ApiError ? err.message : 'Could not load branches/offices.'))
      .finally(() => setLoading(false));
  }, [token]);

  const hubName = (id: string | null) => hubs.find((h) => h.id === id)?.name || '—';

  async function handleCreateBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.hub_id) { toast('Branch name and hub are required.'); return; }
    setSaving(true);
    try {
      const updated = await createBranch(
        { name: branchForm.name.trim(), hub_id: branchForm.hub_id, address: branchForm.address || undefined, phone: branchForm.phone || undefined },
        token
      );
      // setBranches((prev) => [...prev, created]);
      setBranches((prev) => prev.map((h) => (h.id === editingId ? updated : h)))
      setShowBranchForm(false);
      setBranchForm(INITIAL_BRANCH_FORM);
      toast('Branch created.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create branch.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(branch_id: string){

    if(!token) return

    if(!window.confirm("Do you realy want to delete this branch")){
      return
    }

    try{

      await deleteBranch(branch_id, token)

    }catch(err){


    toast(err instanceof ApiError ? err.message : 'Coudl not delete branch')

  }finally{

  }
}

  async function handleEditBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.hub_id) { toast('Branch name and hub are required.'); return; }
    setSaving(true);
    try {
      const created = await updateBranch(editingId,
        { name: branchForm.name.trim(), hub_id: branchForm.hub_id, address: branchForm.address || undefined, phone: branchForm.phone || undefined },
        token
      );
      // setBranches((prev) => [...prev, created]);
      setShowBranchForm(false);
      setBranchForm(INITIAL_BRANCH_FORM);
      toast('Branch details updated.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update branch details.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleBranchStatus(b: Branch) {
    const newStatus = b.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await updateBranch(b.id, { status: newStatus }, token);
      setBranches((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
      toast(`${b.name} marked ${newStatus}.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update branch status.');
    }
  }

  async function handleCreateOffice(e: React.FormEvent) {
    e.preventDefault();
    if (!officeForm.name.trim() || !officeForm.branch_id) { toast('Local office name and branch are required.'); return; }
    setSaving(true);
    try {
      const created = await createLocalOffice(
        { name: officeForm.name.trim(), branch_id: officeForm.branch_id, address: officeForm.address || undefined, phone: officeForm.phone || undefined },
        token
      );
      setLocalOffices((prev) => [...prev, created]);
      setShowOfficeForm(false);
      setOfficeForm(INITIAL_OFFICE_FORM);
      toast('Local office created.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create local office.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleOfficeStatus(o: LocalOffice) {
    const newStatus = o.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await updateLocalOffice(o.id, { status: newStatus } as Partial<LocalOfficeInput> & { status: string }, token);
      setLocalOffices((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
      toast(`${o.name} marked ${newStatus}.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update local office status.');
    }
  }

  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 rounded-lg bg-page p-1 w-fit">
          <button onClick={() => setTab('branches')} className={`px-4 py-2 text-sm font-semibold rounded-md ${tab === 'branches' ? 'bg-white shadow-sm text-ink' : 'text-muted-foreground'}`}>
            Branches ({branches.length})
          </button>
          <button onClick={() => setTab('offices')} className={`px-4 py-2 text-sm font-semibold rounded-md ${tab === 'offices' ? 'bg-white shadow-sm text-ink' : 'text-muted-foreground'}`}>
            Local Offices ({localOffices.length})
          </button>
        </div>
        {tab === 'branches' ? (
          <button onClick={() => {


            setBranchForm({name: '', hub_id: '', address: '', phone: ''}) 
            setEditingId('')
            setShowBranchForm((s) => !s)}
            
            } className="bg-[#db2203] hover:bg-[#db2203]-light text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5">
            <NavIcon name="plus" size={13} color="#fff" /> {showBranchForm ? 'Cancel' : 'Add Branch'}
          </button>
        ) : (
          <button onClick={() => setShowOfficeForm((s) => !s)} className="bg-[#db2203] hover:bg-[#db2203]-light text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5">
            <NavIcon name="plus" size={13} color="#fff" /> {showOfficeForm ? 'Cancel' : 'Add Local Office'}
          </button>
        )}
      </div>

      {tab === 'branches' && showBranchForm && (
        <form onSubmit={editingId ? handleEditBranch : handleCreateBranch} className="bg-page rounded-xl p-5 mb-5">
          <h3 className="font-display font-bold text-sm mb-3">{editingId ? 'Update Branch' : 'New Branch'}</h3>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Branch Name">
              <input type="text" required className={inputCls} value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
            </Field>
            <Field label="Hub">
              <select className={inputCls} value={branchForm.hub_id} onChange={(e) => setBranchForm({ ...branchForm, hub_id: e.target.value })}>
                <option value="">Select hub</option>
                {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
            <Field label="Address">
              <input type="text" className={inputCls} value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input type="text" className={inputCls} value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" disabled={saving} className="text-sm font-bold px-5 py-2.5 rounded-lg bg-[#db2203] hover:bg-[#db2203]-light text-white disabled:opacity-60">
              {saving ? 'Saving…' : (editingId ? 'Update Branch' : 'Create Branch')}
            </button>
          </div>
        </form>
      )}

      {tab === 'offices' && showOfficeForm && (
        <form onSubmit={handleCreateOffice} className="bg-page rounded-xl p-5 mb-5">
          <h3 className="font-display font-bold text-sm mb-3">New Local Office</h3>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Office Name">
              <input type="text" required className={inputCls} value={officeForm.name} onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })} />
            </Field>
            <Field label="Branch">
              <select className={inputCls} value={officeForm.branch_id} onChange={(e) => setOfficeForm({ ...officeForm, branch_id: e.target.value })}>
                <option value="">Select branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Address">
              <input type="text" className={inputCls} value={officeForm.address} onChange={(e) => setOfficeForm({ ...officeForm, address: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input type="text" className={inputCls} value={officeForm.phone} onChange={(e) => setOfficeForm({ ...officeForm, phone: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" disabled={saving} className="text-sm font-bold px-5 py-2.5 rounded-lg bg-[#db2203] hover:bg-[#db2203]-light text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Create Local Office'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground text-xs border-b border-line">
            <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">{tab === 'branches' ? 'Hub' : 'Branch / Hub'}</th><th className="py-2 pr-4">Contact</th>
            <th className="py-2 pr-4">Manager</th><th className="py-2 pr-4">Status</th><th className="py-2">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : tab === 'branches' ? (
              branches.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No branches yet.</td></tr>
              ) : branches.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4"><div className="font-bold text-ink">{b.name}</div><div className="text-xs text-muted-foreground">{b.address}</div></td>
                  <td className="py-3 pr-4"><Pill status="blue" label={hubName(b.hub_id)} /></td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">{b.phone || '—'}</td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">{b.manager_name || 'Unassigned'}</td>
                  <td className="py-3 pr-4"><Pill status={b.status || 'active'} /></td>
                  <td className="py-3 flex items-center gap-2">
                    <button className='font-bold' onClick={() => {
                      setEditingId(b.id)
                      setBranchForm(branchToForm(b))
                      setShowBranchForm(true)
                    }}>Edit</button>
                    <button onClick={() => toggleBranchStatus(b)} className="text-xs font-bold text-muted-foreground hover:underline">
                      {b.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDelete(b.id)} className='text-danger font-bold'>Delete</button>
                  </td>
                </tr>
              ))
            ) : localOffices.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No local offices yet.</td></tr>
            ) : localOffices.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="py-3 pr-4"><div className="font-bold text-ink">{o.name}</div><div className="text-xs text-muted-foreground">{o.address}</div></td>
                <td className="py-3 pr-4">
                  <Pill status="blue" label={o.branch_name || '—'} />
                  <div className="text-xs text-muted-foreground mt-1">{o.hub_name || '—'}</div>
                </td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{o.phone || '—'}</td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{o.manager_name || 'Unassigned'}</td>
                <td className="py-3 pr-4"><Pill status={o.status || 'active'} /></td>
                <td className="py-3">
                  <button onClick={() => toggleOfficeStatus(o)} className="text-xs font-bold text-muted-foreground hover:underline">
                    {o.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
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
// ZONES
// ============================================================
function ZonesView({ zones, hubs, onDelete }: { zones: Zone[]; hubs: Hub[]; onDelete: (z: Zone) => void }) {

  const [showAddNewZone, setShowAddNewZone] = useState(false);
  const [showEditZoneForm, setshowEditZoneForm] = useState(false);
  const {token, setToken} = useAuth();
  const [zone, setZone] = useState<Zone>({
    id: '',
    name: '',
    description: '',
    base_rate: 0,
    cod_fee_percentage: 0,
    branch_count: 0,
    is_live: false,
    is_active: false 
  })

  

  

  async function handleAddCity(payload: AddCityPayload){
    if(!token){
      return;
    }

    try{
      await addCity(payload, token);
      // toast(`${payload.city_name} added with branch "${payload.branch_name}".`);
      setShowAddNewZone(false);
      // loadAll()
    }catch(err){
      // toast(err instanceof ApiError ? err.message : 'Could not add city.');
    }
  }

  interface ZoneFormState{
    zone_name: string;
    zone_description: string;
  }

  

  async function handleEditCity(payload: EditCityPayload){

    if(!token) return

    try{

      await editCity(zone.id,payload, token)
      setshowEditZoneForm(false)

    }catch(err){

    }

  }


  const branchCount = (zoneId: string) => hubs.filter((h) => h.zone_id === zoneId).length;
  return (

    

    <section className="bg-white border border-line rounded-2xl p-5">
      {showAddNewZone && (
        <AddCityModal onClose={() => setShowAddNewZone(false)} onCreate={handleAddCity} />
      )}
      {showEditZoneForm && (
        <EditCityModel onClose={() => setshowEditZoneForm(false)} onCreate={handleEditCity} zone={zone}/>
      )}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-base">Service Zones</h2>
          <p className="text-xs text-muted-foreground">Coverage areas grouping hubs together - each is a city (use "Add City" to create one with its first hub)</p>
        </div>

        <div>
          <button className='sm:flex items-center gap-1.5 bg-[#db2203] hover:bg-[#db2203]-light text-white font-bold text-sm px-4 py-2.5 rounded-[10px] transition-colors whitespace-nowrap' onClick={() => setShowAddNewZone(true)}>
              Add City
          </button>
        </div>
      </div>

     
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground text-xs border-b border-line">
            <th className="py-2">Zone</th>
            <th className="py-2">Description</th>
            <th className="py-2">Hubs</th>
            <th className="py-2">Status</th>
            <th className="py-2">Live</th>
            <th className='py-2'>Actions</th>
          </tr>
          </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id} className="border-b border-line last:border-0">
              <td className="py-3 font-bold text-ink">{z.name}</td>
              <td className="py-3 text-muted-foreground text-xs max-w-sm">{z.description}</td>
              <td className="py-3">{z.branch_count ?? branchCount(z.id)}</td>
              <td className="py-3"><Pill status={z.is_active ? 'green' : 'gray'} label={z.is_active ? 'Active' : 'Inactive'} /></td>
              <td className="py-3">
                {z.is_live === false ? (
                  <span title="No active branch in this zone - bookings won't route through it">
                    <Pill status="amber" label="No branch" />
                  </span>
                ) : (
                  <Pill status="green" label="Live" />
                )}
              </td>
              <td className="py-3 flex gap-3 items-center justify-items-center">
                <button className='className="text-xs font-bold text-[#909d00] border border-danger/30 rounded-lg px-3 py-1.5 hover:bg-[#FBEAE7] flex items-center gap-1"' onClick={() => {

                  setZone(z)
                  setshowEditZoneForm(true)

                }}> 
                  Edit
                </button>
                <button onClick={
                  () => onDelete(z)
                  // () => null
                  } className="text-xs font-bold text-[#db2203] border border-danger/30 rounded-lg px-3 py-1.5 hover:bg-[#FBEAE7] flex items-center gap-1">
                  <NavIcon name="trash" size={12} color="#E6350F" /> Remove
                </button>
              </td>
            </tr>
          ))}
          {zones.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No zones yet.</td></tr>}
        </tbody>
      </table>


    </section>


  );
}

// ============================================================
// STAFF & ADMINS
// ============================================================
// ============================================================
// RIDER LEADERBOARD
// ============================================================
function LeaderboardView({ token, toast }: { token: string; toast: (msg: string) => void }) {
  const [rows, setRows] = useState<RiderLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [sortBy, setSortBy] = useState<'deliveries' | 'earnings' | 'success_rate'>('deliveries');

  useEffect(() => {
    setLoading(true);
    getRiderLeaderboard(token, days, sortBy)
      .then(setRows)
      .catch((err) => toast(err instanceof ApiError ? err.message : 'Could not load leaderboard.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, days, sortBy]);

  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-base">Rider Leaderboard</h2>
          <p className="text-xs text-muted-foreground">{rows.length} riders with completed deliveries in this window</p>
        </div>
        <div className="flex gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputCls + ' w-auto'}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={inputCls + ' w-auto'}>
            <option value="deliveries">Sort by deliveries</option>
            <option value="earnings">Sort by earnings</option>
            <option value="success_rate">Sort by success rate</option>
          </select>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground text-xs border-b border-line">
          <th className="py-2 pr-4">#</th><th className="py-2 pr-4">Rider</th><th className="py-2 pr-4">Branch</th>
          <th className="py-2 pr-4">Rating</th><th className="py-2 pr-4">Deliveries</th><th className="py-2 pr-4">RTOs</th>
          <th className="py-2 pr-4">Success Rate</th><th className="py-2">Earnings</th>
        </tr></thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No completed deliveries in this window.</td></tr>
          ) : rows.map((r, i) => (
            <tr key={r.rider_id} className="border-b border-line last:border-0">
              <td className="py-3 pr-4 text-muted-foreground">{i + 1}</td>
              <td className="py-3 pr-4"><AvatarChip name={r.full_name} /></td>
              <td className="py-3 pr-4 text-muted-foreground">{r.branch_name || '—'}</td>
              <td className="py-3 pr-4 text-ink">⭐ {r.rating.toFixed(1)}</td>
              <td className="py-3 pr-4 text-ink font-semibold">{r.deliveries}</td>
              <td className="py-3 pr-4 text-muted-foreground">{r.rto_count}</td>
              <td className="py-3 pr-4"><Pill status={r.success_rate >= 90 ? 'green' : r.success_rate >= 75 ? 'yellow' : 'red'} label={`${r.success_rate}%`} /></td>
              <td className="py-3 text-ink">Rs {r.earnings.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StaffView({ users, roleFilter, setRoleFilter, onDelete, onResetPassword }: {
  users: AdminUser[]; roleFilter: string; setRoleFilter: (v: string) => void; onDelete: (u: AdminUser) => void;
  onResetPassword: (u: AdminUser) => void;
}) {
  const roles = ['admin', 'super_admin', 'staff', 'rider', 'customer'];
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-base">Staff & Admins</h2>
          <p className="text-xs text-muted-foreground">{users.length} accounts{roleFilter ? ` · filtered by ${titleStatus(roleFilter)}` : ''}</p>
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inputCls + ' w-auto'}>
          <option value="">All roles</option>
          {roles.map((r) => <option key={r} value={r}>{titleStatus(r)}</option>)}
        </select>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground text-xs border-b border-line">
          <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Contact</th>
          <th className="py-2 pr-4">Verified</th><th className="py-2 pr-4">Active</th><th className="py-2">Action</th>
        </tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-line last:border-0">
              <td className="py-3 pr-4"><AvatarChip name={u.full_name} /></td>
              <td className="py-3 pr-4"><Pill status="blue" label={titleStatus(u.role)} /></td>
              <td className="py-3 pr-4 text-xs text-muted-foreground">{u.phone}<br />{u.email}</td>
              <td className="py-3 pr-4"><Pill status={u.is_verified ? 'green' : 'gray'} label={u.is_verified ? 'Verified' : 'Unverified'} /></td>
              <td className="py-3 pr-4"><Pill status={u.is_active ? 'green' : 'red'} label={u.is_active ? 'Active' : 'Suspended'} /></td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => onResetPassword(u)} className="text-xs font-bold text-navy border border-line rounded-lg px-3 py-1.5 hover:bg-page">
                    Reset Password
                  </button>
                  <button onClick={() => onDelete(u)} className="text-xs font-bold text-[#db2203] border border-danger/30 rounded-lg px-3 py-1.5 hover:bg-[#FBEAE7] flex items-center gap-1">
                    <NavIcon name="trash" size={12} color="#E6350F" /> Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No accounts match this filter.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

// A city needs both a Zone (so addresses in it can match a service area) and
// at least one active Branch pointed at that zone (so a booking actually
// routes somewhere) - see order_service.create_order. Bundling both into one
// form/request (POST /admin/cities) means a city can't be half set up the
// way separately creating a bare Zone always could be.
function AddCityModal({ onClose, onCreate }: { onClose: () => void; onCreate: (payload: AddCityPayload) => void }) {
  const [form, setForm] = useState<AddCityPayload>({
    city_name: '',
    description: '',
    base_rate: 5,
    cod_fee_percentage: 3,
    branch_name: '',
    branch_address: '',
    branch_phone: '',
    branch_email: '',
    opening_time: '',
    closing_time: '',
  });

  function update<K extends keyof AddCityPayload>(key: K, value: AddCityPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal title="Add City" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(form);
        }}
        className="grid sm:grid-cols-2 gap-4"
      >
        <Field label="City Name"><input required className={inputCls} value={form.city_name} onChange={(e) => update('city_name', e.target.value)} /></Field>
        <Field label="Description (optional)"><input className={inputCls} value={form.description} onChange={(e) => update('description', e.target.value)} /></Field>
        <Field label="Base delivery rate (PKR)"><input type="number" min={0} className={inputCls} value={form.base_rate} onChange={(e) => update('base_rate', Number(e.target.value))} /></Field>
        <Field label="COD fee (%)"><input type="number" min={0} step={0.1} className={inputCls} value={form.cod_fee_percentage} onChange={(e) => update('cod_fee_percentage', Number(e.target.value))} /></Field>

        <div className="sm:col-span-2 border-t border-line pt-3 mt-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">First Hub in this city</p>
          <p className="text-xs text-muted-foreground">A city needs at least one active branch to actually receive bookings.</p>
        </div>
        <Field label="Hub Name"><input required className={inputCls} value={form.branch_name} onChange={(e) => update('branch_name', e.target.value)} /></Field>
        <Field label="Hub Address"><input className={inputCls} value={form.branch_address} onChange={(e) => update('branch_address', e.target.value)} /></Field>
        <Field label="Hub Phone"><input className={inputCls} value={form.branch_phone} onChange={(e) => update('branch_phone', e.target.value)} /></Field>
        <Field label="Hub Email"><input type="email" className={inputCls} value={form.branch_email} onChange={(e) => update('branch_email', e.target.value)} /></Field>
        <Field label="Opening Time"><input placeholder="09:00 AM" className={inputCls} value={form.opening_time} onChange={(e) => update('opening_time', e.target.value)} /></Field>
        <Field label="Closing Time"><input placeholder="09:00 PM" className={inputCls} value={form.closing_time} onChange={(e) => update('closing_time', e.target.value)} /></Field>

        <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="text-sm font-bold px-4 py-2.5 rounded-lg border border-line text-ink hover:bg-page">Cancel</button>
          <button type="submit" className="text-sm font-bold px-4 py-2.5 rounded-lg bg-[#db2203] hover:bg-[#db2203]-light text-white">Add City</button>
        </div>
      </form>
    </Modal>
  )
}

function EditCityModel({ onClose, onCreate, zone }: { onClose: () => void; zone: Zone; onCreate: (payload: EditCityPayload) => void }) {
  const [form, setForm] = useState<EditCityPayload>({
    name: zone.name,
    description: zone.description,
    base_rate: zone.base_rate,
    cod_fee_percentage: zone.cod_fee_percentage,
    is_active: zone.is_active
  });
  

  function update<K extends keyof EditCityPayload>(key: K, value: EditCityPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal title="Edit City" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(form);
        }}
        className="grid sm:grid-cols-2 gap-4"
      >
        <Field label="City Name"><input required className={inputCls} value={form.name} onChange={(e) => update('name', e.target.value)} /></Field>
        <Field label="Description (optional)"><input className={inputCls} value={form.description} onChange={(e) => update('description', e.target.value)} /></Field>
        <Field label="Base delivery rate (PKR)"><input type="number" min={0} className={inputCls} value={form.base_rate} onChange={(e) => update('base_rate', Number(e.target.value))} /></Field>
        <Field label="COD fee (%)"><input type="number" min={0} step={0.1} className={inputCls} value={form.cod_fee_percentage} onChange={(e) => update('cod_fee_percentage', Number(e.target.value))} /></Field>
        
        <Field label="Is Active">
          <select
            className={inputCls}
            value={String(form.is_active)}
            onChange={(e) => update('is_active', e.target.value === 'true')}
          >
            <option value="true">Active</option>
            <option value="false">Disable</option>
          </select>
        </Field>

        <div className="sm:col-span-2 border-t border-line pt-3 mt-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">First Hub in this city</p>
          <p className="text-xs text-muted-foreground">A city needs at least one active branch to actually receive bookings.</p>
        </div>

        <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="text-sm font-bold px-4 py-2.5 rounded-lg border border-line text-ink hover:bg-page">Cancel</button>
          <button type="submit" className="text-sm font-bold px-4 py-2.5 rounded-lg bg-[#db2203] hover:bg-[#db2203]-light text-white">Edit City</button>
        </div>
      </form>
    </Modal>
  )
}

function CreateUserModal({ hubs, branches, localOffices, zones, onClose, onCreate }: {
  hubs: Hub[]; branches: Branch[]; localOffices: LocalOffice[]; zones: Zone[]; onClose: () => void; onCreate: (payload: AdminCreateUserPayload) => void;
}) {
  const [form, setForm] = useState<AdminCreateUserPayload>({
    full_name: '', email: '', phone: '', cnic: '', password: '', role: 'staff_hub', designation: '', zone_id: '', hub_id: '',
  });
  function update<K extends keyof AdminCreateUserPayload>(key: K, val: AdminCreateUserPayload[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function formatPhone(raw: string) :string{

    const digits = raw.replace(/[^0-9]/g, '').slice(0,11);
    let out = digits;
    if(digits.length > 4) out = digits.slice(0,4) + '-' + digits.slice(4);

    return out;
  }

  function formatCNIC(raw: string): string{

    const digits = raw.replace(/[^0-9]/g, '').slice(0, 13);
  let out = digits;
  if (digits.length > 5) out = digits.slice(0, 5) + '-' + digits.slice(5);
  if (digits.length > 12) out = out.slice(0, 13) + '-' + digits.slice(12);
  return out;
  }
  const needsHub = form.role === 'staff_hub' || form.role === 'rider' || form.role === 'manager' || form.role === 'admin';
  const needsBranch = form.role === 'hub_manager';
  const needsLocalBranch = form.role === 'local_office_manager';
  return (
    <Modal title="Create staff, rider or admin account" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); onCreate(form); }} className="grid sm:grid-cols-2 gap-4">
        <Field label="Full name"><input required className={inputCls} value={form.full_name} onChange={(e) => update('full_name', e.target.value)} /></Field>
        <Field label="Role">
          <select className={inputCls} value={form.role} onChange={(e) => { const r = e.target.value as AdminCreateUserPayload['role']; setForm((f) => ({ ...f, role: r, hub_id: '', branch_id: '', local_branch_id: '' })); }}>
            <option value="staff_hub">Staff (Hub)</option>
            <option value="staff_branch">Staff (Branch)</option>
            <option value="staff_local_branch">Staff (Local Branch)</option>
            <option value="rider">Rider</option>
            <option value="manager">Hub Manager (city)</option>
            <option value="admin">Admin</option>
            <option value="hub_manager">Branch Manager (sorting)</option>
            <option value="local_office_manager">Local Office Manager</option>
          </select>
        </Field>
        <Field label="Email"><input required type="email" className={inputCls} value={form.email} onChange={(e) => update('email', e.target.value)} /></Field>
        <Field label="Phone">
          <input required className={inputCls} value={form.phone} onChange={(e) => update('phone', formatPhone(e.target.value))} />
          </Field>
        <Field label="CNIC"><input required className={inputCls} value={form.cnic} onChange={(e) => update('cnic', formatCNIC(e.target.value))} /></Field>
        <Field label="Temporary password"><input required type="password" className={inputCls} value={form.password} onChange={(e) => update('password', e.target.value)} /></Field>
        <Field label="Designation"><input className={inputCls} value={form.designation} onChange={(e) => update('designation', e.target.value)} placeholder="e.g. Branch Coordinator" /></Field>
        <Field label="Zone">
          <select className={inputCls} value={form.zone_id} onChange={(e) => update('zone_id', e.target.value)}>
            <option value="">Select a zone</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </Field>
        {needsHub && (
          <Field label="Hub (city office)">
            <select className={inputCls} value={form.hub_id} onChange={(e) => update('hub_id', e.target.value)}>
              <option value="">Select a hub</option>
              {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Field>
        )}
        {needsBranch && (
          <Field label="Branch (sorting)">
            <select className={inputCls} value={form.branch_id} onChange={(e) => update('branch_id', e.target.value)}>
              <option value="">Select a branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        )}
        {needsLocalBranch && (
          <Field label="Local Office">
            <select className={inputCls} value={form.local_branch_id} onChange={(e) => update('local_branch_id', e.target.value)}>
              <option value="">Select a local office</option>
              {localOffices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
        <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="text-sm font-bold px-4 py-2.5 rounded-lg border border-line text-ink hover:bg-page">Cancel</button>
          <button type="submit" className="text-sm font-bold px-4 py-2.5 rounded-lg bg-[#db2203] hover:bg-[#db2203]-light text-white">Create Account</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// BUSINESS ACCOUNTS
// ============================================================
function BusinessView({ accounts, token, toast, onChanged }: {
  accounts: AdminSeller[]; token: string; toast: (msg: string) => void;
  onChanged: React.Dispatch<React.SetStateAction<AdminSeller[]>>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function runAction(businessId: string, action: (id: string, t: string) => Promise<any>, success: string) {
    setBusyId(businessId);
    try {
      const updated = await action(businessId, token);
      onChanged((prev) => prev.map((s) => (s.business_id === businessId ? { ...s, status: updated.status, is_active: updated.is_active } : s)));
      toast(success);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update account.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-base">Business Accounts</h2>
          <p className="text-xs text-muted-foreground">Corporate and merchant shipping accounts</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground text-xs border-b border-line">
          <th className="py-2 pr-4">Business</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Total Orders</th>
          <th className="py-2 pr-4">COD</th><th className="py-2 pr-4">City</th><th className="py-2 pr-4">Status</th><th className="py-2">Actions</th>
        </tr></thead>
        <tbody>
          {accounts.length === 0 && (
            <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No business accounts yet.</td></tr>
          )}
          {accounts.map((b) => (
            <tr key={b.business_id} className="border-b border-line last:border-0">
              <td className="py-3 pr-4"><div className="font-bold text-ink">{b.company_name}</div><div className="text-xs text-muted-foreground">{b.phone}</div></td>
              <td className="py-3 pr-4"><Pill status="blue" label={b.business_type ?? 'Unspecified'} /></td>
              <td className="py-3 pr-4">{b.total_orders.toLocaleString()}</td>
              <td className="py-3 pr-4"><Pill status={b.cod_service ? 'green' : 'gray'} label={b.cod_service ? 'Enabled' : 'Disabled'} /></td>
              <td className="py-3 pr-4 text-muted-foreground">{b.city}</td>
              <td className="py-3"><Pill status={b.status} /></td>
              <td className="py-3">
                {b.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button disabled={busyId === b.business_id} onClick={() => runAction(b.business_id, approveSeller, `${b.company_name} approved.`)}
                      className="text-xs font-bold text-white bg-[#1E8E5A] hover:opacity-90 rounded-lg px-3 py-1.5 disabled:opacity-50">Approve</button>
                    <button disabled={busyId === b.business_id} onClick={() => runAction(b.business_id, rejectSeller, `${b.company_name} rejected.`)}
                      className="text-xs font-bold text-[#db2203] border border-danger/30 rounded-lg px-3 py-1.5 hover:bg-[#FBEAE7] disabled:opacity-50">Reject</button>
                  </div>
                )}
                {b.status === 'active' && (
                  <button disabled={busyId === b.business_id} onClick={() => runAction(b.business_id, deactivateSeller, `${b.company_name} deactivated.`)}
                    className="text-xs font-bold text-[#db2203] border border-danger/30 rounded-lg px-3 py-1.5 hover:bg-[#FBEAE7] disabled:opacity-50">Deactivate</button>
                )}
                {(b.status === 'suspended' || b.status === 'rejected') && (
                  <button disabled={busyId === b.business_id} onClick={() => runAction(b.business_id, activateSeller, `${b.company_name} reactivated.`)}
                    className="text-xs font-bold text-navy border border-line rounded-lg px-3 py-1.5 hover:bg-page disabled:opacity-50">Reactivate</button>
                )}
              </td>
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
      <p className="text-xs text-muted-foreground mb-4">Templates sent automatically as an order moves through its lifecycle</p>
      <div className="flex flex-col gap-3">
        {templates.length === 0 && <p className="text-sm text-muted-foreground">No message templates configured yet.</p>}
        {templates.map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-4 border border-line rounded-xl p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-ink">{t.trigger}</span>
                <Pill status="blue" label={t.channel} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xl font-mono">{t.body}</p>
            </div>
            <button onClick={() => onToggle(t.id)} className={`flex-none w-11 h-6 rounded-full relative transition-colors ${t.active ? 'bg-[#db2203]' : 'bg-line'}`}>
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
          <p className="text-xs text-muted-foreground mb-4">Current distribution, network-wide</p>
          <div className="flex flex-col gap-2.5">
            {statusEntries.map(([status, count]) => (
              <div key={status}>
                <div className="flex justify-between text-xs font-semibold text-ink mb-1"><span>{titleStatus(status)}</span><span>{count}</span></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden"><div className="h-full bg-[#db2203]" style={{ width: `${(count / maxStatus) * 100}%` }} /></div>
              </div>
            ))}
            {statusEntries.length === 0 && <div className="text-sm text-muted-foreground">No data yet.</div>}
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Orders by Booking Channel</h2>
          <p className="text-xs text-muted-foreground mb-4">Where orders are coming from</p>
          <StatStrip items={channelEntries.map(([channel, count]) => ({ num: count, label: titleStatus(channel) }))} />
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-display font-bold text-base mb-1">Top Riders (by rating)</h2>
          <table className="w-full text-sm mt-3">
            <thead><tr className="text-left text-muted-foreground text-xs border-b border-line"><th className="py-2">Rider</th><th className="py-2">Rating</th><th className="py-2">Success</th></tr></thead>
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
            {analytics ? [
              { label: 'Delivery Success Rate', thisWeek: analytics.network_comparison.this_week.delivery_success_rate, lastWeek: analytics.network_comparison.last_week.delivery_success_rate },
              { label: 'On-Time Pickup Rate', thisWeek: analytics.network_comparison.this_week.on_time_pickup_rate, lastWeek: analytics.network_comparison.last_week.on_time_pickup_rate },
              { label: 'Avg. Rider Utilization', thisWeek: analytics.network_comparison.this_week.rider_utilization, lastWeek: analytics.network_comparison.last_week.rider_utilization },
            ].map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs font-semibold text-ink mb-1"><span>{c.label}</span><span>{c.thisWeek}% vs {c.lastWeek}%</span></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden mb-1"><div className="h-full bg-[#db2203]" style={{ width: `${c.thisWeek}%` }} /></div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden"><div className="h-full bg-[#B7BEC9]" style={{ width: `${c.lastWeek}%` }} /></div>
              </div>
            )) : <p className="text-sm text-muted-foreground">Loading…</p>}
            <div className="text-xs text-muted-foreground mt-1"><span className="text-[#db2203] font-bold">■</span> This week &nbsp; <span className="text-[#B7BEC9] font-bold">■</span> Last week</div>
          </div>
        </section>
      </div>
    </>
  );
}

// ============================================================
// ALERTS
// ============================================================
function AlertsView({ notifications }: { notifications: NotificationItem[] }) {
  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <h2 className="font-display font-bold text-base mb-1">Alerts & Notifications</h2>
      <p className="text-xs text-muted-foreground mb-4">Everything flagged for super admin review</p>
      <div className="flex flex-col gap-2.5">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">You're all caught up — nothing flagged.</p>
        ) : (
          notifications.map((n) => <AlertCard key={n.id} alert={notificationToAlert(n)} />)
        )}
      </div>
    </section>
  );
}

function AlertCard({ alert }: { alert: { sev: 'high' | 'medium' | 'low'; title: string; msg: string; time: string } }) {
  const border = alert.sev === 'high' ? '#E6350F' : alert.sev === 'medium' ? '#F2A93B' : '#B7BEC9';
  return (
    <div className="flex gap-3 border-l-4 rounded-lg bg-page p-3.5" style={{ borderColor: border }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-none text-white" style={{ background: border }}>
        <NavIcon name="alert" size={13} />
      </div>
      <div>
        <div className="font-bold text-sm text-ink">{alert.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{alert.msg}</div>
        <div className="text-xs text-muted-foreground/70 mt-1">{alert.time}</div>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function SettingsView({ toast, token }: { toast: (msg: string) => void; token: string }) {
  const [currency, setCurrency] = useState('PKR');
  const [codLimit, setCodLimit] = useState('15000');
  const [autoAssign, setAutoAssign] = useState(true);
  const [assignRadius, setAssignRadius] = useState('3');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getNetworkSettings(token)
      .then((s) => {
        setCurrency(s.default_currency);
        setCodLimit(String(s.manual_review_cod_threshold));
        setAutoAssign(s.auto_assign_enabled);
        setAssignRadius(String(s.default_assignment_radius_km));
      })
      .catch((err) => toast(err instanceof ApiError ? err.message : 'Could not load network settings.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: NetworkSettings = {
      default_currency: currency,
      manual_review_cod_threshold: parseFloat(codLimit) || 0,
      auto_assign_enabled: autoAssign,
      default_assignment_radius_km: parseFloat(assignRadius) || 0,
    };
    setSaving(true);
    try {
      await updateNetworkSettings(payload, token);
      toast('Settings saved.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white border border-line rounded-2xl p-5 max-w-2xl">
      <h2 className="font-display font-bold text-base mb-1">Network Defaults</h2>
      <p className="text-xs text-muted-foreground mb-5">These apply to every branch unless a branch overrides them</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Default currency">
          <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="PKR">PKR — Pakistani Rupee</option>
            <option value="USD">USD — US Dollar</option>
          </select>
        </Field>
        <Field label="Manual-review COD threshold">
          <input className={inputCls} type="number" value={codLimit} onChange={(e) => setCodLimit(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between border border-line rounded-xl p-4">
          <div>
            <div className="font-bold text-sm text-ink">Automatic rider assignment</div>
            <div className="text-xs text-muted-foreground mt-0.5">When on, new orders are matched to riders automatically using the active assignment rules.</div>
          </div>
          <button type="button" onClick={() => setAutoAssign((v) => !v)} className={`flex-none w-11 h-6 rounded-full relative transition-colors ${autoAssign ? 'bg-[#db2203]' : 'bg-line'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoAssign ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <Field label="Default assignment search radius (km)">
          <input className={inputCls} type="number" value={assignRadius} onChange={(e) => setAssignRadius(e.target.value)} disabled={!autoAssign} />
        </Field>
        <div className="flex justify-end mt-2">
          <button type="submit" disabled={loading || saving} className="text-sm font-bold px-5 py-2.5 rounded-lg bg-[#db2203] hover:bg-[#db2203]-light text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      <div className="mt-8">
        <h2 className="font-display font-bold text-base mb-1">Announcements & Notifications</h2>
        <p className="text-xs text-muted-foreground mb-4">Broadcast to the network or a single hub</p>
        <AnnouncementsPanel token={token} admin />
      </div>
    </section>
  );
}