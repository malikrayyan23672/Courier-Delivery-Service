'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import { Field } from '@/components/Field';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import {
  bookOrder,
  listMyOrders,
  getMyProfile,
  Order,
  MyProfile,
  ApiError,
} from '@/lib/api';

const BOX_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
  </svg>
);

const SEARCH_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const USER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const SHIPMENTS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="15" height="13" rx="1" />
    <path d="M16 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1" />
  </svg>
);

const OVERVIEW_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-[#EAF1FC] text-navy',
  assigned: 'bg-[#FBF3EA] text-orange',
  picked_up: 'bg-[#FBF3EA] text-orange',
  in_transit: 'bg-[#FBF3EA] text-orange',
  delivered: 'bg-[#EAF7EF] text-success',
  failed: 'bg-[#FBEAE7] text-danger',
  cancelled: 'bg-[#F0F0F0] text-muted',
};

const STATUS_FILTERS = ['all', 'created', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'];

type Tab = 'overview' | 'shipments' | 'profile';

type BookingForm = {
  pickup_address: string;
  pickup_city: string;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  dropoff_address: string;
  dropoff_city: string;
  dropoff_contact_name: string;
  dropoff_contact_phone: string;
  weight: string;
  description: string;
  // package_size: string;
};

const EMPTY_FORM: BookingForm = {
  pickup_address: '',
  pickup_city: '',
  pickup_contact_name: '',
  pickup_contact_phone: '',
  dropoff_address: '',
  dropoff_city: '',
  dropoff_contact_name: '',
  dropoff_contact_phone: '',
  weight: '',
  description: '',
  // package_size: '',
};

export default function DashboardPage() {
  return (
    <RoleGuard allowedRoles={['customer']}>
      <DashboardContent />
    </RoleGuard>
  );
}

function DashboardContent() {
  const { token, isLoading, setToken } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState('');

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [profileError, setProfileError] = useState('');

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<BookingForm>(EMPTY_FORM);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
    }
  }, [isLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    setLoadingOrders(true);
    listMyOrders(token)
      .then(setOrders)
      .catch((err) => setOrdersError(err instanceof ApiError ? err.message : 'Could not load your shipments.'))
      .finally(() => setLoadingOrders(false));

    getMyProfile(token)
      .then(setProfile)
      .catch((err) => setProfileError(err instanceof ApiError ? err.message : 'Could not load your profile.'));
  }, [token]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setFormError('');
    try {
      const order = await bookOrder(
        {
          pickup_address: {
            full_address: form.pickup_address,
            city: form.pickup_city,
            contact_name: form.pickup_contact_name || undefined,
            contact_phone: form.pickup_contact_phone || undefined,
          },
          dropoff_address: {
            full_address: form.dropoff_address,
            city: form.dropoff_city,
            contact_name: form.dropoff_contact_name || undefined,
            contact_phone: form.dropoff_contact_phone || undefined,
          },
          package_weight_kg: form.weight ? parseFloat(form.weight) : undefined,
          // package_size: form.package_size || undefined,
          package_description: form.description || undefined,
        },
        token
      );
      setOrders((prev) => [order, ...prev]);
      setShowBookingForm(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not book order.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  const stats = useMemo(() => {
    const inTransit = orders.filter((o) => ['assigned', 'picked_up', 'in_transit'].includes(o.status)).length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const totalSpent = orders.reduce((sum, o) => sum + (o.final_price ?? o.estimated_price ?? 0), 0);
    return { total: orders.length, inTransit, delivered, totalSpent };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        o.tracking_number.toLowerCase().includes(term) ||
        (o.dropoff_address?.full_address?.toLowerCase().includes(term) ?? false) ||
        (o.pickup_address?.full_address?.toLowerCase().includes(term) ?? false);
      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  if (isLoading || !token) return null;

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-5">
          {profile && (
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
                {profile.full_name.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-ink">{profile.full_name}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-sm font-semibold text-muted hover:text-navy transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        <nav className="flex gap-1 mb-7 bg-white rounded-[14px] p-1.5 shadow-card w-fit">
          {(
            [
              ['overview', 'Overview', OVERVIEW_ICON],
              ['shipments', 'My Shipments', SHIPMENTS_ICON],
              ['profile', 'Profile', USER_ICON],
            ] as [Tab, string, React.ReactNode][]
          ).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold transition-colors ${
                tab === id ? 'bg-navy text-white' : 'text-muted hover:text-ink hover:bg-page'
              }`}
            >
              <span className="w-4 h-4">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {tab === 'overview' && (
          <OverviewTab
            stats={stats}
            orders={orders}
            loadingOrders={loadingOrders}
            ordersError={ordersError}
            showBookingForm={showBookingForm}
            setShowBookingForm={setShowBookingForm}
            form={form}
            setForm={setForm}
            handleBook={handleBook}
            submitting={submitting}
            formError={formError}
            onSelectOrder={setSelectedOrderId}
            onViewAll={() => setTab('shipments')}
          />
        )}

        {tab === 'shipments' && (
          <ShipmentsTab
            orders={filteredOrders}
            allCount={orders.length}
            loadingOrders={loadingOrders}
            ordersError={ordersError}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onSelectOrder={setSelectedOrderId}
          />
        )}

        {tab === 'profile' && <ProfileTab profile={profile} profileError={profileError} />}
      </main>

      {selectedOrderId && token && (
        <OrderDetailModal orderId={selectedOrderId} token={token} onClose={() => setSelectedOrderId(null)} />
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{label}</p>
      <p className={`font-display text-2xl font-bold ${accent || 'text-ink'}`}>{value}</p>
    </div>
  );
}

function OrderRow({ order, onSelect }: { order: Order; onSelect: (id: string) => void }) {
  return (
    <tr
      onClick={() => onSelect(order.id)}
      className="border-b border-line last:border-0 cursor-pointer hover:bg-page/70 transition-colors"
    >
      <td className="px-6 py-3.5 font-mono text-ink">{order.tracking_number}</td>
      <td className="px-6 py-3.5">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-line text-ink'}`}>
          {order.status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-6 py-3.5 text-muted capitalize hidden sm:table-cell">{order.booking_channel}</td>
      <td className="px-6 py-3.5 text-muted hidden md:table-cell max-w-[220px] truncate">
        {order.dropoff_address?.full_address || '—'}
      </td>
      <td className="px-6 py-3.5 text-ink text-right">
        {order.final_price ?? order.estimated_price ? `Rs. ${order.final_price ?? order.estimated_price}` : '—'}
      </td>
    </tr>
  );
}

function BookingFormFields({
  form,
  setForm,
  handleBook,
  submitting,
  formError,
}: {
  form: BookingForm;
  setForm: React.Dispatch<React.SetStateAction<BookingForm>>;
  handleBook: (e: React.FormEvent) => void;
  submitting: boolean;
  formError: string;
}) {
  return (
    <form onSubmit={handleBook} className="bg-white rounded-card shadow-card p-6 md:p-8 mb-8">
      <h2 className="font-display font-bold text-lg mb-5">Pickup &amp; Drop-off Details</h2>
      <div className="grid md:grid-cols-2 gap-x-6">
        <Field
          id="pickup_address"
          label="Pickup Address"
          icon={BOX_ICON}
          placeholder="House/street, area"
          required
          value={form.pickup_address}
          onChange={(e) => setForm((f) => ({ ...f, pickup_address: e.target.value }))}
        />
        <Field
          id="pickup_city"
          label="Pickup City"
          icon={BOX_ICON}
          placeholder="e.g. Islamabad"
          value={form.pickup_city}
          onChange={(e) => setForm((f) => ({ ...f, pickup_city: e.target.value }))}
        />
        <Field
          id="pickup_contact_name"
          label="Pickup Contact Name"
          icon={BOX_ICON}
          placeholder="Who should the rider ask for?"
          value={form.pickup_contact_name}
          onChange={(e) => setForm((f) => ({ ...f, pickup_contact_name: e.target.value }))}
        />
        <Field
          id="pickup_contact_phone"
          label="Pickup Contact Phone"
          icon={BOX_ICON}
          placeholder="e.g. 03001234567"
          value={form.pickup_contact_phone}
          onChange={(e) => setForm((f) => ({ ...f, pickup_contact_phone: e.target.value }))}
        />
        <Field
          id="dropoff_address"
          label="Drop-off Address"
          icon={BOX_ICON}
          placeholder="House/street, area"
          required
          value={form.dropoff_address}
          onChange={(e) => setForm((f) => ({ ...f, dropoff_address: e.target.value }))}
        />
        <Field
          id="dropoff_city"
          label="Drop-off City"
          icon={BOX_ICON}
          placeholder="e.g. Lahore"
          value={form.dropoff_city}
          onChange={(e) => setForm((f) => ({ ...f, dropoff_city: e.target.value }))}
        />
        <Field
          id="dropoff_contact_name"
          label="Recipient Name"
          icon={BOX_ICON}
          placeholder="Who's receiving it?"
          value={form.dropoff_contact_name}
          onChange={(e) => setForm((f) => ({ ...f, dropoff_contact_name: e.target.value }))}
        />
        <Field
          id="dropoff_contact_phone"
          label="Recipient Phone"
          icon={BOX_ICON}
          placeholder="e.g. 03001234567"
          value={form.dropoff_contact_phone}
          onChange={(e) => setForm((f) => ({ ...f, dropoff_contact_phone: e.target.value }))}
        />
        <Field
          id="weight"
          type="number"
          step="0.1"
          label="Package Weight (kg)"
          icon={BOX_ICON}
          placeholder="e.g. 2.5"
          value={form.weight}
          onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
        />
        <Field
          id="description"
          label="Package Description"
          icon={BOX_ICON}
          placeholder="e.g. Documents"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        {/* <Field
          id="package_size"
          type="text"
          label="Package Size"
          icon={BOX_ICON}
          placeholder="e.g. Medium"
          value={form.package_size}
          onChange={(e) => setForm((f) => ({ ...f, package_size: e.target.value }))}
        /> */}
      </div>

      {formError && <p className="text-sm text-danger mb-4">{formError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-navy hover:bg-navy-light text-white font-bold text-sm px-6 py-3 rounded-[10px] disabled:opacity-60 transition-colors"
      >
        {submitting ? 'Booking…' : 'Confirm Booking'}
      </button>
    </form>
  );
}

interface OverviewTabProps {
  stats: { total: number; inTransit: number; delivered: number; totalSpent: number };
  orders: Order[];
  loadingOrders: boolean;
  ordersError: string;
  showBookingForm: boolean;
  setShowBookingForm: React.Dispatch<React.SetStateAction<boolean>>;
  form: BookingForm;
  setForm: React.Dispatch<React.SetStateAction<BookingForm>>;
  handleBook: (e: React.FormEvent) => void;
  submitting: boolean;
  formError: string;
  onSelectOrder: (id: string) => void;
  onViewAll: () => void;
}

function OverviewTab({
  stats,
  orders,
  loadingOrders,
  ordersError,
  showBookingForm,
  setShowBookingForm,
  form,
  setForm,
  handleBook,
  submitting,
  formError,
  onSelectOrder,
  onViewAll,
}: OverviewTabProps) {
  const recent = orders.slice(0, 5);
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Your Shipments</h1>
          <p className="text-muted text-sm mt-1">Book a new pickup or check on an existing order</p>
        </div>
        <button
          onClick={() => setShowBookingForm((s) => !s)}
          className="bg-orange hover:bg-orange-light text-white font-bold text-sm px-5 py-3 rounded-[10px] transition-colors"
        >
          {showBookingForm ? 'Cancel' : '+ Book a Shipment'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Shipments" value={String(stats.total)} />
        <StatCard label="In Transit" value={String(stats.inTransit)} accent="text-orange" />
        <StatCard label="Delivered" value={String(stats.delivered)} accent="text-success" />
        <StatCard label="Total Spent" value={`Rs. ${stats.totalSpent.toLocaleString()}`} />
      </div>

      {showBookingForm && (
        <BookingFormFields form={form} setForm={setForm} handleBook={handleBook} submitting={submitting} formError={formError} />
      )}

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display font-bold text-sm text-ink">Recent Shipments</h2>
          {orders.length > 5 && (
            <button onClick={onViewAll} className="text-xs font-semibold text-orange hover:text-orange-light transition-colors">
              View all →
            </button>
          )}
        </div>
        {ordersError ? (
          <p className="p-6 text-danger text-sm">{ordersError}</p>
        ) : loadingOrders ? (
          <p className="p-6 text-muted text-sm">Loading your orders…</p>
        ) : recent.length === 0 ? (
          <p className="p-6 text-muted text-sm">No shipments yet. Book your first one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-6 py-3 font-semibold">Tracking #</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold hidden sm:table-cell">Channel</th>
                <th className="px-6 py-3 font-semibold hidden md:table-cell">Drop-off</th>
                <th className="px-6 py-3 font-semibold text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((order) => (
                <OrderRow key={order.id} order={order} onSelect={onSelectOrder} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

interface ShipmentsTabProps {
  orders: Order[];
  allCount: number;
  loadingOrders: boolean;
  ordersError: string;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  onSelectOrder: (id: string) => void;
}

function ShipmentsTab({
  orders,
  allCount,
  loadingOrders,
  ordersError,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onSelectOrder,
}: ShipmentsTabProps) {
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">My Shipments</h1>
        <p className="text-muted text-sm mt-1">
          {allCount} shipment{allCount === 1 ? '' : 's'} total
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none">
            {SEARCH_ICON}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tracking number or address"
            className="w-full text-sm py-2.5 pl-[42px] pr-3.5 rounded-[10px] border-[1.5px] border-line bg-white outline-none focus:border-orange transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm py-2.5 px-3.5 rounded-[10px] border-[1.5px] border-line bg-white outline-none focus:border-orange transition-colors capitalize"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s === 'all' ? 'All statuses' : s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        {ordersError ? (
          <p className="p-6 text-danger text-sm">{ordersError}</p>
        ) : loadingOrders ? (
          <p className="p-6 text-muted text-sm">Loading your orders…</p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-muted text-sm">No shipments match your search.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-6 py-3 font-semibold">Tracking #</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold hidden sm:table-cell">Channel</th>
                <th className="px-6 py-3 font-semibold hidden md:table-cell">Drop-off</th>
                <th className="px-6 py-3 font-semibold text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} onSelect={onSelectOrder} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ProfileTab({ profile, profileError }: { profile: MyProfile | null; profileError: string }) {
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Profile</h1>
        <p className="text-muted text-sm mt-1">Your account details</p>
      </div>

      {profileError && <p className="text-danger text-sm mb-4">{profileError}</p>}

      {!profile && !profileError ? (
        <p className="text-muted text-sm">Loading your profile…</p>
      ) : profile ? (
        <div className="bg-white rounded-card shadow-card p-6 md:p-8 max-w-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-navy text-white flex items-center justify-center text-xl font-bold shrink-0">
              {profile.full_name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="font-display font-bold text-lg text-ink">{profile.full_name}</p>
              <span
                className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  profile.is_verified ? 'bg-[#EAF7EF] text-success' : 'bg-[#FBF3EA] text-orange'
                }`}
              >
                {profile.is_verified ? 'Verified account' : 'Phone not verified'}
              </span>
            </div>
          </div>

          <dl className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <dt className="text-sm text-muted">Email</dt>
              <dd className="text-sm font-semibold text-ink">{profile.email}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-line pb-4">
              <dt className="text-sm text-muted">Phone</dt>
              <dd className="text-sm font-semibold text-ink">{profile.phone}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-line pb-4">
              <dt className="text-sm text-muted">Account type</dt>
              <dd className="text-sm font-semibold text-ink capitalize">{profile.role}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted">Status</dt>
              <dd className="text-sm font-semibold text-ink">{profile.is_active ? 'Active' : 'Disabled'}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </>
  );
}
