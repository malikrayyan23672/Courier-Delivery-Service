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

function TeamTab({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', CNIC: '', password: '', role: 'staff' as 'staff' | 'rider' | 'admin' | 'customer' });

  useEffect(() => {
    loadUsers();
  }, [token]);

  function loadUsers() {
    setLoading(true);
    listStaffAndRiders(token)
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load team.'))
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
      setForm({ full_name: '', email: '', phone: '', CNIC: '', password: '', role: 'staff' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteUser(id: string): void {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setError('');
    setUsers((prev) => prev.filter((u) => u.id !== id));
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
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Field
              id="CNIC"
              label="CNIC"
              placeholder="e.g. 12345-1234567-1"
              icon={CNIC_ICON}
              required
              value={form.CNIC}
              onChange={(e) => setForm((f) => ({ ...f, CNIC: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as typeof f.role }))}
              className="w-full text-[0.92rem] py-3 px-3.5 rounded-[10px] border-[1.5px] border-line bg-[#FBFCFE] text-ink outline-none focus:border-orange"
            >
              <option value="staff">Staff (counter/office)</option>
              <option value="rider">Rider (delivery)</option>
              <option value="admin">Admin</option>
              <option value="customer">Customer</option>
            </select>
          </div>

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
                <th className="px-6 py-3 font-semibold">CNIC</th>
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
                  <td className="px-6 py-3.5 text-muted">{u.CNIC}</td>
                  <td className="px-6 py-3.5">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF1FC] text-navy capitalize">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className='px-6 py-3.5'>
                    <button 
                      onClick={() => handleDeleteUser(u.id)}
                      className="text-danger hover:text-danger-light focus:outline-none"
                    >
                      Delete
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