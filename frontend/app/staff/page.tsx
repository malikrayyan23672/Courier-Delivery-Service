'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import {
  bookStaffOrder,
  listStaffOrders,
  listStaffRiders,
  staffAssignRider,
  Order,
  StaffRider,
  ApiError,
} from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
  created: 'info',
  assigned: 'warning',
  picked_up: 'warning',
  in_transit: 'warning',
  delivered: 'success',
  failed: 'danger',
  cancelled: 'secondary',
};

export default function StaffPage() {
  return (
    <RoleGuard allowedRoles={['staff', 'admin', 'super_admin']}>
      <StaffContent />
    </RoleGuard>
  );
}

function StaffContent() {
  const { token, setToken } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<'book' | 'orders'>('book');

  // Booking Form State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Order | null>(null);
  const [form, setForm] = useState({
    guest_full_name: '',
    guest_phone: '',
    pickup_address: '',
    pickup_city: '',
    dropoff_address: '',
    dropoff_city: '',
    weight: '',
    description: '',
    payment_method: 'cash',
    package_size: 'small',
  });

  // Branch Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<StaffRider[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState('');

  // Fetch branch orders and zone riders when switching to orders tab
  useEffect(() => {
    if (tab === 'orders' && token) {
      loadBranchData();
    }
  }, [tab, token]);

  function loadBranchData() {
    setLoadingOrders(true);
    setOrdersError('');
    Promise.all([listStaffOrders(token!), listStaffRiders(token!)])
      .then(([o, r]) => {
        setOrders(o);
        setRiders(r);
      })
      .catch((err) => {
        setOrdersError(err instanceof ApiError ? err.message : 'Could not load branch data.');
      })
      .finally(() => {
        setLoadingOrders(false);
      });
  }

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');
    setBooked(null);
    try {
      const order = await bookStaffOrder(
        {
          guest_full_name: form.guest_full_name,
          guest_phone: form.guest_phone,
          pickup_address: { full_address: form.pickup_address, city: form.pickup_city },
          dropoff_address: { full_address: form.dropoff_address, city: form.dropoff_city },
          package_weight_kg: form.weight ? parseFloat(form.weight) : undefined,
          package_description: form.description || undefined,
          package_size: form.package_size as 'small' | 'medium' | 'large' | 'documents',
          payment_method: form.payment_method as 'cash' | 'card' | 'online_gateway',
        },
        token
      );

      setBooked(order);
      setForm({
        guest_full_name: '',
        guest_phone: '',
        pickup_address: '',
        pickup_city: '',
        dropoff_address: '',
        dropoff_city: '',
        weight: '',
        description: '',
        payment_method: 'cash',
        package_size: 'small',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not book order.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(orderId: string, riderId: string) {
    if (!riderId || !token) return;
    setAssigningId(orderId);
    setOrdersError('');
    try {
      await staffAssignRider(orderId, riderId, token);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'assigned', rider_accepted: null } : o))
      );
    } catch (err) {
      setOrdersError(err instanceof ApiError ? err.message : 'Could not assign rider.');
    } finally {
      setAssigningId(null);
    }
  }

  const selectCls =
    'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <Badge variant="warning">Staff Panel</Badge>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-navy" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 md:px-10 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 border-b border-line">
          <button
            onClick={() => setTab('book')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'book' ? 'border-orange text-orange' : 'border-transparent text-muted-foreground hover:text-ink'
            }`}
          >
            Book Walk-in Shipment
          </button>
          <button
            onClick={() => setTab('orders')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'orders' ? 'border-orange text-orange' : 'border-transparent text-muted-foreground hover:text-ink'
            }`}
          >
            Branch Orders
          </button>
        </div>

        {tab === 'book' ? (
          <div>
            <h1 className="font-display text-2xl font-bold text-ink mb-1">Book a Walk-in Shipment</h1>
            <p className="text-muted-foreground text-sm mb-6">
              For customers booking in person at the counter. Payment is collected on the spot.
            </p>

            {booked && (
              <div className="bg-[#EAF7EF] border border-success/30 rounded-[10px] px-5 py-4 mb-6">
                <p className="font-bold text-success">Order booked successfully</p>
                <p className="text-sm text-ink mt-1">
                  Tracking number: <span className="font-mono font-bold">{booked.tracking_number}</span>
                  {booked.estimated_price ? ` — Rs. ${booked.estimated_price}` : ''}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <Card className="p-6 md:p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-lg">Customer Details</CardTitle>
                </CardHeader>
                <CardContent className="px-0 space-y-6">
                  <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="guest_full_name">Full Name</Label>
                      <Input id="guest_full_name" placeholder="Customer's name" required value={form.guest_full_name} onChange={(e) => update('guest_full_name', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="guest_phone">Phone Number</Label>
                      <Input id="guest_phone" placeholder="e.g. 03001234567" required value={form.guest_phone} onChange={(e) => update('guest_phone', e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <CardTitle className="text-lg mb-4">Pickup &amp; Drop-off</CardTitle>
                    <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="pickup_address">Pickup Address</Label>
                        <Input id="pickup_address" placeholder="House/street, area" required value={form.pickup_address} onChange={(e) => update('pickup_address', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pickup_city">Pickup City</Label>
                        <Input id="pickup_city" placeholder="e.g. Rawalpindi" value={form.pickup_city} onChange={(e) => update('pickup_city', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dropoff_address">Drop-off Address</Label>
                        <Input id="dropoff_address" placeholder="House/street, area" required value={form.dropoff_address} onChange={(e) => update('dropoff_address', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dropoff_city">Drop-off City</Label>
                        <Input id="dropoff_city" placeholder="e.g. Lahore" value={form.dropoff_city} onChange={(e) => update('dropoff_city', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="weight">Package Weight (kg)</Label>
                        <Input id="weight" type="number" step="0.1" placeholder="e.g. 1.5" value={form.weight} onChange={(e) => update('weight', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="description">Package Description</Label>
                        <Input id="description" placeholder="e.g. Small parcel" value={form.description} onChange={(e) => update('description', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="payment_method">Payment Method</Label>
                    <select id="payment_method" value={form.payment_method} onChange={(e) => update('payment_method', e.target.value)} className={selectCls}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="online_gateway">Online payment link</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="package_size">Package Size</Label>
                    <select id="package_size" value={form.package_size} onChange={(e) => setForm((f) => ({ ...f, package_size: e.target.value }))} className={selectCls}>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                      <option value="documents">Documents</option>
                    </select>
                  </div>

                  {error && <p className="text-sm text-danger">{error}</p>}

                  <Button type="submit" disabled={submitting} variant="navy">
                    {submitting ? 'Booking…' : 'Confirm Booking'}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </div>
        ) : (
          <div>
            <h1 className="font-display text-2xl font-bold text-ink mb-1">Branch Shipments</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Manage deliveries associated with your branch and assign riders manually.
            </p>

            {ordersError && (
              <div className="bg-[#FBEAE7] text-danger text-sm rounded-[10px] px-4 py-3 mb-6">
                {ordersError}
              </div>
            )}

            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {loadingOrders ? (
                  <p className="p-6 text-muted-foreground text-sm text-center">Loading orders…</p>
                ) : orders.length === 0 ? (
                  <p className="p-6 text-muted-foreground text-sm text-center">No shipments booked for this branch yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Tracking #</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Assign Rider</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono font-bold text-ink">{order.tracking_number}</TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANT[order.status] || 'secondary'} className="capitalize">
                                {order.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <p className="text-ink max-w-xs truncate">{order.dropoff_address?.full_address}</p>
                              <span className="text-xs text-muted-foreground block mt-0.5">{order.dropoff_address?.city || 'Lahore'}</span>
                            </TableCell>
                            <TableCell>
                              {order.status === 'created' ? (
                                <select
                                  disabled={assigningId === order.id}
                                  onChange={(e) => handleAssign(order.id, e.target.value)}
                                  defaultValue=""
                                  className="text-sm py-1.5 px-2.5 rounded-[8px] border border-line bg-page text-ink max-w-[180px] outline-none focus:border-orange cursor-pointer"
                                >
                                  <option value="" disabled>
                                    {assigningId === order.id ? 'Assigning…' : 'Select Rider'}
                                  </option>
                                  {riders.map((r) => (
                                    <option key={r.rider_id} value={r.rider_id}>
                                      {r.full_name} ({r.vehicle_type || 'bike'})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}