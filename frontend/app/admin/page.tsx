'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import { Field } from '@/components/Field';
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

type Tab = 'orders' | 'team' | 'settings' | 'analytics';

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-[#EAF1FC] text-navy',
  assigned: 'bg-[#FBF3EA] text-orange',
  picked_up: 'bg-[#FBF3EA] text-orange',
  in_transit: 'bg-[#FBF3EA] text-orange',
  delivered: 'bg-[#EAF7EF] text-success',
  failed: 'bg-[#FBEAE7] text-danger',
  cancelled: 'bg-[#F0F0F0] text-muted',
};

const USER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const CNIC_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10h-6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2z" /><path d="M7 21H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2z" />
    <line x1="7" y1="7" x2="7" y2="7" /><line x1="11" y1="7" x2="11" y2="7" /><line x1="7" y1="11" x2="7" y2="11" /><line x1="11" y1="11" x2="11" y2="11" />
  </svg>
)
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
  const [tab, setTab] = useState<Tab>('orders');

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-orange bg-[#FBF3EA] px-3 py-1 rounded-full">
            Admin Panel
          </span>
          <button onClick={handleLogout} className="text-sm font-semibold text-muted hover:text-navy transition-colors">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        <div className="flex gap-2 mb-6 border-b border-line">
          {(['orders', 'team', 'settings', 'analytics'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t ? 'border-orange text-orange' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t === 'orders' ? 'All Orders' : t === 'team' ? 'Team' : t === 'settings' ? 'Settings' : 'Analytics'}
            </button>
          ))}
        </div>

        {tab === 'orders' ? (
          <OrdersTab token={token!} />
        ) : tab === 'team' ? (
          <TeamTab token={token!} />
        ) : tab === 'settings' ? (
          <SettingsTab token={token!} />
        ) : (
          <AnalyticsTab token={token!} />
        )}
      </main>
    </div>
  );
}

function OrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<AdminRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState('');



  const SEARCH_ICON = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );



  useEffect(() => {
    Promise.all([listAllOrders(token), listRiders(token)])
      .then(([o, r]) => {
        setOrders(o);
        setRiders(r);
      })
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

  if (loading) return <p className="text-muted text-sm">Loading orders…</p>;

  return (
    <div>
      {error && <p className="text-sm text-danger mb-4">{error}</p>}
      <div className="bg-white rounded-card shadow-card overflow-hidden">
        {orders.length === 0 ? (
          <p className="p-6 text-muted text-sm">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-6 py-3 font-semibold">Tracking #</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Channel</th>
                <th className="px-6 py-3 font-semibold">Assign Rider</th>
                <th className="px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3.5 font-mono text-ink">{order.tracking_number}</td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-line text-ink'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-muted capitalize">{order.booking_channel}</td>
                  <td className="px-6 py-3.5">
                    {order.status === 'created' ? (
                      <select
                        disabled={assigningId === order.id}
                        onChange={(e) => handleAssign(order.id, e.target.value)}
                        defaultValue=""
                        className="text-sm py-1.5 px-2 rounded-[8px] border border-line bg-[#FBFCFE]"
                      >
                        <option value="" disabled>
                          {assigningId === order.id ? 'Assigning…' : 'Select rider'}
                        </option>
                        {riders.map((r) => (
                          <option key={r.rider_id} value={r.rider_id}>
                            {r.full_name} ({r.vehicle_type || 'rider'})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <a
                      href={`/admin/orders/${order.id}`}
                      className="text-sm font-semibold text-navy hover:text-navy-light transition-colors"
                    >
                      View
                    </a>
                    <a href={`/admin/orders/${order.id}/edit`} className="ml-4 text-sm font-semibold text-orange hover:text-orange-light transition-colors">
                      Edit
                    </a>
                    <a href={`/admin/orders/${order.id}/delete`} className="ml-4 text-sm font-semibold text-danger hover:text-danger-light transition-colors">
                      Delete
                    </a>
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

function SettingsTab({token}: {token: string}){
  return(
    <div>
      <p className="text-muted text-sm">Settings will be available in a future update.</p>
    </div>
  );
}

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

  // const [form, setForm] = useState({ full_name: '', email: '', phone: '', cnic: '', password: '', role: 'staff' as 'staff' | 'rider' | 'admin' | 'customer', designation: '', zone_id: '', branch_id: '' });
const INITIAL_FORM: FormState = {
  full_name: '', email: '', phone: '', cnic: '', password: '', role: 'staff' as 'staff' | 'rider' | 'admin' | 'customer', designation: '', zone_id: '', branch_id: '',
};

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
  // const [form, setForm] = useState({ full_name: '', email: '', phone: '', cnic: '', password: '', role: 'staff' as 'staff' | 'rider' | 'admin' | 'customer', designation: '', zone_id: '', branch_id: '' });

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

  function loadBranches(){

    setLoading(true)
    listBranches(token)
    .then(setBranches)
    .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load branches'))
    .finally(() => setLoading(false))
  }

  function filterBranches(zone_id: string){

    setFilteredBranches(branches.filter((o) => o.zone_id == zone_id))
  }

  function loadZones(){

    setLoading(true)
    listZones(token)
    .then(setZones)
    .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load zones.'))
    .finally(() => setLoading(false))

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
    deleteUserbyAdmin(id,token);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  const ICONS = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  pin: <><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 6 10 7 10-7" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 3a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c1 .3 2 .5 3 .7a2 2 0 0 1 1.7 2z" />,
  lock: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  idCard: <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.2" /><path d="M14 10h5M14 14h5" /></>,
  building: <><rect x="3" y="3" width="12" height="18" rx="1" /><path d="M15 8h6v13h-6M7 7h.01M11 7h.01M7 11h.01M11 11h.01M7 15h.01M11 15h.01" /></>,
  layers: <><path d="m21 8-9-6-9 6 9 6 9-6z" /><path d="M3 8v8l9 6 9-6V8" /></>,
  doc: <><path d="M9 12h6M9 16h6M9 8h6" /><rect x="4" y="3" width="16" height="18" rx="2" /></>,
  tax: <><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h5" /></>,
  box: <><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
  truck: <><rect x="1" y="6" width="15" height="11" /><path d="M16 10h4l3 3v4h-7z" /><circle cx="6" cy="18" r="2" /><circle cx="18.5" cy="18" r="2" /></>,
  city: <path d="M3 21V9l6-4 6 4v12M15 21v-8l6 4v4" />,
  map: <path d="M4 4h16v16H4zM4 10h16M10 4v16" />,
  mailbox: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7h18" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-6-3.8-9s1.3-6.4 3.8-9z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  bank: <><path d="M3 10 12 4l9 6" /><path d="M4 10v10h16V10M9 14v4M15 14v4" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></>,
  fastDelivery: <><rect x="1" y="6" width="15" height="11" /><path d="M16 10h4l3 3v4h-7z" /><circle cx="6" cy="18" r="2" /><circle cx="18.5" cy="18" r="2" /></>,
  shield: <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />,
  worldwide: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-6-3.8-9s1.3-6.4 3.8-9z" /></>,
  support: <><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3z" /><path d="M3 19a2 2 0 0 0 2 2h1v-6H3z" /></>,
};

function Icon({ path, size = 18 }: { path: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
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

function formatPhone(raw: string) : string{
  const digits = raw.replace(/[^0-9]/g, '').slice(0,11);
  let out = digits;
  if(digits.length > 4) out = digits.slice(0,4) + '-' + digits.slice(4);

  return out;
}

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-muted text-sm">Customer, Staff, rider, and admin accounts</p>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-orange hover:bg-orange-light text-white font-bold text-sm px-5 py-2.5 rounded-[10px] transition-colors"
        >
          {showForm ? 'Cancel' : '+ Onboard Team Member'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-card shadow-card p-6 md:p-8 mb-6">
          <h2 className="font-display font-bold text-lg mb-4">New Team Member</h2>
          <div className="grid md:grid-cols-2 gap-x-6">
            <Field
              id="full_name"
              label="Full Name"
              placeholder='Enter your full name'
              icon={USER_ICON}
              required
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
            <Field
              id="email"
              type="email"
              label="Email"
              icon={MAIL_ICON}
              placeholder='Enter email'
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Field
              id="phone"
              label="Phone Number"
              icon={PHONE_ICON}
              placeholder="e.g. 03001234567"
              required
              value={form.phone}
              // onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              onChange={(e) => set('phone', formatPhone(e.target.value))} 
            />
            {/* <Field
              id="cnic"
              label="cnic"
              placeholder="e.g. 12345-1234567-1"
              icon={CNIC_ICON}
              required
              value={form.cnic}
              onChange={(e) => setForm((f) => ({ ...f, cnic: e.target.value }))}
            /> */}
            <Field 
            id="cnic" 
            label="CNIC Number *" 
            icon={<Icon path={ICONS.idCard} />} 
            placeholder="#####-#######-#" maxLength={15}
                        value={form.cnic} 
                        // onChange={(e) => set('cnic', formatCnic(e.target.value))} error={error.cnic} 
                        onChange={(e) => set('cnic', formatCnic(e.target.value))} 
                        />
            <Field
              id="password"
              type="password"
              label="Temporary Password"
              icon={LOCK_ICON}
              minLength={8}
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>

          <div className="mb-5">
            <label className="text-[0.82rem] font-semibold text-ink block mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={(e) => {
                const newRole = e.target.value as typeof form.role;
                setForm((f) => ({
                  ...f, role: newRole, zone_id: '', branch_id: '', designation: ''
                }))
                setShowStaffZoneSelector(newRole === "staff" || newRole === "rider")
                setShowDesignationSelector(newRole === "staff")
                setShowStaffBranchSelector(false)
              }}
              className="w-full text-[0.92rem] py-3 px-3.5 rounded-[10px] border-[1.5px] border-line bg-[#FBFCFE] text-ink outline-none focus:border-orange"
            >
              <option value="staff">Staff (counter/office)</option>
              <option value="rider">Rider (delivery)</option>
              {/* <option value="admin">Admin</option> */}
              {/* <option value="customer">Customer</option> */}
            </select>
          </div>

          {showStaffZoneSelector && (
           <div className="mb-5">
            <label className="text-[0.82rem] font-semibold text-ink block mb-1.5">Zone</label>
            <select
              value={form.zone_id}
              onChange={(e) => {
                const selectedZoneId = e.target.value;
                setForm((f) => ({
                  ...f, zone_id: selectedZoneId, branch_id: ''
                }))
                filterBranches(selectedZoneId)
                setShowStaffBranchSelector(selectedZoneId !== '')
              }}
              className="w-full text-[0.92rem] py-3 px-3.5 rounded-[10px] border-[1.5px] border-line bg-[#FBFCFE] text-ink outline-none focus:border-orange"
            >
              <option value="">Select a zone</option>
              {zones.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>           
          )}

          {showStaffBranchSelector && (
           <div className="mb-5">
            <label className="text-[0.82rem] font-semibold text-ink block mb-1.5">Branch</label>
            <select
              value={form.branch_id}
              onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
              className="w-full text-[0.92rem] py-3 px-3.5 rounded-[10px] border-[1.5px] border-line bg-[#FBFCFE] text-ink outline-none focus:border-orange"
            >
              <option value="">Select a branch</option>
              {filteredBranches.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>           
          )}

          {showDesignationSelector && (
            <div className="mb-5">
            <label className="text-[0.82rem] font-semibold text-ink block mb-1.5">Designation</label>
            <select
              value={form.designation}
              onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              className="w-full text-[0.92rem] py-3 px-3.5 rounded-[10px] border-[1.5px] border-line bg-[#FBFCFE] text-ink outline-none focus:border-orange"
            >
              <option value="">Select a designation</option>
              <option value="manager">Manager</option>
              <option value="manager">Operator</option>
            </select>
          </div>           
          )}

          {error && <p className="text-sm text-danger mb-4">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="bg-navy hover:bg-navy-light text-white font-bold text-sm px-6 py-3 rounded-[10px] disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Creating…' : 'Create Account'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        {loading ? (
          <p className="p-6 text-muted text-sm">Loading team…</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-muted text-sm">No staff or riders onboarded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Phone</th>
                <th className="px-6 py-3 font-semibold">cnic</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3.5 text-ink font-semibold">{u.full_name}</td>
                  <td className="px-6 py-3.5 text-muted">{u.email}</td>
                  <td className="px-6 py-3.5 text-muted">{u.phone}</td>
                  <td className="px-6 py-3.5 text-muted">{u.cnic}</td>
                  <td className="px-6 py-3.5">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF1FC] text-navy capitalize">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className='px-6 py-3.5'>
                    {u.role === "staff" || u.role === "rider" || u.role === "customer" ? (
                      <button 
                      onClick={() => handleDeleteUser(u.id)}
                      className="text-danger hover:text-danger-light focus:outline-none"
                    >
                      Delete
                    </button>
                    ) : (
                      <button></button>
                    )}
                    
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
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminAnalytics(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load analytics.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-muted text-sm">Loading analytics…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return null;

  const maxDaily = Math.max(1, ...data.daily_last_7_days.map((d) => d.revenue));
  const statusEntries = Object.entries(data.status_counts);
  const maxStatus = Math.max(1, ...statusEntries.map(([, c]) => c));
  const channelEntries = Object.entries(data.channel_counts);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-card shadow-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Total orders</p>
          <p className="font-display text-3xl font-bold text-navy">{data.total_orders}</p>
        </div>
        <div className="bg-white rounded-card shadow-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Total revenue (delivered)</p>
          <p className="font-display text-3xl font-bold text-success">${data.total_revenue.toFixed(2)}</p>
        </div>
      </div>

      {/* revenue last 7 days */}
      <div className="bg-white rounded-card shadow-card p-5">
        <p className="font-display font-bold text-ink mb-4">Revenue — last 7 days</p>
        {data.daily_last_7_days.length === 0 ? (
          <p className="text-sm text-muted">No delivered orders in the last 7 days yet.</p>
        ) : (
          <div className="flex items-end gap-3" style={{ height: 140 }}>
            {data.daily_last_7_days.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-md bg-orange"
                  style={{ height: `${Math.max(4, (d.revenue / maxDaily) * 100)}px` }}
                  title={`$${d.revenue.toFixed(2)} · ${d.orders} orders`}
                />
                <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* orders by status */}
        <div className="bg-white rounded-card shadow-card p-5">
          <p className="font-display font-bold text-ink mb-4">Orders by status</p>
          <div className="flex flex-col gap-2.5">
            {statusEntries.map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="w-24 text-xs text-muted capitalize shrink-0">{status.replace('_', ' ')}</span>
                <div className="flex-1 bg-page rounded-full h-2.5 overflow-hidden">
                  <div className="h-full bg-navy rounded-full" style={{ width: `${(count / maxStatus) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-ink w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* booking channel mix */}
        <div className="bg-white rounded-card shadow-card p-5">
          <p className="font-display font-bold text-ink mb-4">Booking channel mix</p>
          <div className="flex flex-col gap-2.5">
            {channelEntries.map(([channel, count]) => (
              <div key={channel} className="flex items-center gap-3">
                <span className="w-24 text-xs text-muted capitalize shrink-0">{channel.replace('_', ' ')}</span>
                <div className="flex-1 bg-page rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-orange rounded-full"
                    style={{ width: `${(count / Math.max(1, ...channelEntries.map(([, c]) => c))) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-ink w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* top riders */}
      <div className="bg-white rounded-card shadow-card p-5">
        <p className="font-display font-bold text-ink mb-4">Top riders (by delivered orders)</p>
        {data.top_riders.length === 0 ? (
          <p className="text-sm text-muted">No delivered orders yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.top_riders.map((r, i) => (
              <div key={r.full_name + i} className="flex items-center justify-between border-b border-line last:border-0 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#EAF1FC] text-navy text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-ink">{r.full_name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted">{r.deliveries} deliveries</span>
                  <span className="font-semibold text-success">${r.earnings.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}