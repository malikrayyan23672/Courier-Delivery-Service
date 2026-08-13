'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  listSettlements,
  getSettlementSummary,
  settleT1,
  settleOne,
  Settlement,
  listWallets,
  setWalletLock,
  reconcileWallet,
  listWalletTransactions,
  Wallet,
  WalletTransaction,
  listBusOperators,
  createBusOperator,
  listBusSchedules,
  createBusSchedule,
  listBusManifests,
  createBusManifest,
  addManifestItem,
  updateManifestStatus,
  BusOperator,
  BusSchedule,
  BusManifest,
  listRNP,
  setRNPStatus,
  RNP,
  listDiscounts,
  createDiscount,
  toggleDiscount,
  Discount,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
  pending: 'warning',
  paid: 'success',
  cancelled: 'secondary',
  approved: 'success',
  suspended: 'danger',
  in_preparation: 'info',
  in_transit: 'warning',
  arrived: 'success',
  loaded: 'info',
  active: 'success',
  matched: 'success',
  mismatched: 'danger',
  in_review: 'warning',
  uploaded: 'info',
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const variant = STATUS_VARIANT[status] || 'secondary';
  return (
    <Badge variant={variant} className="capitalize">
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const selectCls =
  'h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

const thCls = 'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const tdCls = 'px-5 py-3.5 align-middle';
const rowCls = 'border-b border-line last:border-0 hover:bg-muted/30 transition-colors';

function useApi<T>(loader: (token: string) => Promise<T>, token: string, reloadKey = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    loader(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load data.'))
      .finally(() => setLoading(false));
  }, [token, reloadKey]);

  return { data, loading, error, setData, setError };
}

function CardLoader({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

// ============================== COD SETTLEMENTS ==============================

export function CodSettlementsTab({ token }: { token: string }) {
  const [reload, setReload] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ pending_count: number; pending_amount: number } | null>(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const { data: settlements, loading } = useApi(
    (t) => listSettlements(t, statusFilter || undefined),
    token,
    reload
  );

  function loadSummary() {
    getSettlementSummary(token)
      .then(setSummary)
      .catch(() => {});
  }

  useEffect(() => {
    loadSummary();
  }, [token, reload]);

  async function handleSettleT1() {
    setBusy(true);
    setError('');
    setResult('');
    try {
      const res = await settleT1(token, 'T+1 manual settlement');
      setResult(
        `Settled ${res.settled.length} payout(s). ${res.blocked.length ? `${res.blocked.length} held back (wallet locked).` : ''}`
      );
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not run settlement.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSettleOne(id: string) {
    try {
      await settleOne(id, token);
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not settle payout.');
    }
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}
      {result && <div className="rounded-lg border border-success/30 bg-[#EAF7EF] px-4 py-3 text-sm text-success">{result}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending COD exposure</p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {summary ? summary.pending_amount.toLocaleString() : '—'}
            <span className="text-sm font-semibold text-muted-foreground"> PKR · {summary?.pending_count ?? 0} orders</span>
          </p>
        </Card>
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
          <Button onClick={handleSettleT1} disabled={busy || !summary?.pending_count}>
            {busy ? 'Settling…' : 'Settle T+1 (due now)'}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <CardLoader />
        ) : !settlements || settlements.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No settlements. COD orders get a T+1 settlement record when delivered.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={thCls}>Tracking</th>
                  <th className={thCls}>Seller</th>
                  <th className={thCls}>Amount</th>
                  <th className={thCls}>Due (T+1)</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s: Settlement) => (
                  <tr key={s.id} className={rowCls}>
                    <td className={`${tdCls} font-mono`}>{s.tracking_number || '—'}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{s.company_name || 'Retail'}</td>
                    <td className={`${tdCls} font-semibold`}>{s.amount.toLocaleString()}</td>
                    <td className={`${tdCls} text-muted-foreground`}>
                      {s.settle_due_on ? new Date(s.settle_due_on).toDateString() : '—'}
                    </td>
                    <td className={tdCls}><StatusBadge status={s.status} /></td>
                    <td className={tdCls}>
                      {s.status === 'pending' ? (
                        <Button variant="outline" size="sm" className="text-primary" onClick={() => handleSettleOne(s.id)}>
                          Settle now
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================== BUS NETWORK ==============================

export function BusNetworkTab({ token }: { token: string }) {
  const [section, setSection] = useState<'operators' | 'schedules' | 'manifests'>('operators');
  const pills: { key: 'operators' | 'schedules' | 'manifests'; label: string }[] = [
    { key: 'operators', label: 'Bus Operators' },
    { key: 'schedules', label: 'Departures' },
    { key: 'manifests', label: 'Manifests (Crates)' },
  ];
  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="flex gap-2">
        {pills.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={section === p.key ? 'default' : 'outline'}
            onClick={() => setSection(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {section === 'operators' && <OperatorsSection token={token} />}
      {section === 'schedules' && <SchedulesSection token={token} />}
      {section === 'manifests' && <ManifestsSection token={token} />}
    </div>
  );
}

function OperatorsSection({ token }: { token: string }) {
  const [reload, setReload] = useState(0);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const { data: operators, loading } = useApi((t) => listBusOperators(t), token, reload);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createBusOperator({ name, city, contact_phone: phone, status: 'active' }, token);
      setName(''); setCity(''); setPhone('');
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add operator.');
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card className="p-6">
        <h3 className="mb-4 font-bold text-ink">Add bus operator</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Operator name (e.g. Faisal Movers)" />
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contact phone" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="navy">Add operator</Button>
        </form>
      </Card>
      <Card className="overflow-hidden">
        {loading ? (
          <CardLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={thCls}>Name</th>
                  <th className={thCls}>City</th>
                  <th className={thCls}>Phone</th>
                </tr>
              </thead>
              <tbody>
                {operators?.map((o: BusOperator) => (
                  <tr key={o.id} className={rowCls}>
                    <td className={`${tdCls} font-semibold text-ink`}>{o.name}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{o.city || '—'}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{o.contact_phone || '—'}</td>
                  </tr>
                ))}
                {!operators?.length && <tr><td colSpan={3} className="p-6 text-sm text-muted-foreground">No operators yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SchedulesSection({ token }: { token: string }) {
  const [reload, setReload] = useState(0);
  const [operators, setOperators] = useState<BusOperator[]>([]);
  const [form, setForm] = useState({ operator_id: '', origin_city: '', destination_city: '', departure_time: '', departure_interval_min: 30, fare: '' });
  const [error, setError] = useState('');
  const { data: schedules, loading } = useApi((t) => listBusSchedules(t), token, reload);

  useEffect(() => {
    listBusOperators(token).then(setOperators).catch(() => {});
  }, [token]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createBusSchedule(
        {
          operator_id: form.operator_id,
          origin_city: form.origin_city,
          destination_city: form.destination_city,
          departure_time: form.departure_time || null,
          departure_interval_min: Number(form.departure_interval_min),
          fare: form.fare ? Number(form.fare) : null,
          status: 'active',
        },
        token
      );
      setForm({ operator_id: '', origin_city: '', destination_city: '', departure_time: '', departure_interval_min: 30, fare: '' });
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add schedule.');
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card className="p-6">
        <h3 className="mb-1 font-bold text-ink">Add departure</h3>
        <p className="mb-4 text-xs text-muted-foreground">Dispatch every 30–45 minutes per corridor.</p>
        <form onSubmit={handleAdd} className="space-y-3">
          <select value={form.operator_id} onChange={(e) => setForm({ ...form, operator_id: e.target.value })} required className={selectCls + ' w-full'}>
            <option value="" disabled>Select operator</option>
            {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <Input value={form.origin_city} onChange={(e) => setForm({ ...form, origin_city: e.target.value })} required placeholder="Origin city" />
            <Input value={form.destination_city} onChange={(e) => setForm({ ...form, destination_city: e.target.value })} required placeholder="Destination city" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} placeholder="Time (06:30)" />
            <Input type="number" value={form.departure_interval_min} onChange={(e) => setForm({ ...form, departure_interval_min: Number(e.target.value) })} placeholder="Interval min" />
            <Input value={form.fare} onChange={(e) => setForm({ ...form, fare: e.target.value })} placeholder="Fare PKR" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="navy">Add departure</Button>
        </form>
      </Card>
      <Card className="overflow-hidden">
        {loading ? (
          <CardLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={thCls}>Corridor</th>
                  <th className={thCls}>Operator</th>
                  <th className={thCls}>Interval</th>
                </tr>
              </thead>
              <tbody>
                {schedules?.map((s: BusSchedule) => (
                  <tr key={s.id} className={rowCls}>
                    <td className={`${tdCls} font-semibold text-ink`}>{s.origin_city} → {s.destination_city}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{s.operator_name || '—'}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{s.departure_interval_min ? `Every ${s.departure_interval_min} min` : '—'}</td>
                  </tr>
                ))}
                {!schedules?.length && <tr><td colSpan={3} className="p-6 text-sm text-muted-foreground">No departures yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ManifestsSection({ token }: { token: string }) {
  const [reload, setReload] = useState(0);
  const [schedules, setSchedules] = useState<BusSchedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ schedule_id: '', coach_number: '', origin_city: '', destination_city: '' });
  const [itemForm, setItemForm] = useState<Record<string, { order_id: string; crate: string }>>({});
  const [error, setError] = useState('');
  const { data: manifests, loading } = useApi((t) => listBusManifests(t), token, reload);

  useEffect(() => {
    listBusSchedules(token).then(setSchedules).catch(() => {});
  }, [token]);

  async function handleCreateManifest(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createBusManifest(
        {
          schedule_id: form.schedule_id || undefined,
          coach_number: form.coach_number || undefined,
          origin_city: form.origin_city || undefined,
          destination_city: form.destination_city || undefined,
        },
        token
      );
      setForm({ schedule_id: '', coach_number: '', origin_city: '', destination_city: '' });
      setShowForm(false);
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create manifest.');
    }
  }

  async function handleAddItem(manifestId: string, orderId: string, crate: string) {
    try {
      await addManifestItem(manifestId, orderId || undefined, crate || undefined, token);
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add item.');
    }
  }

  async function handleScan(manifestId: string, status: string, itemStatus: string | undefined) {
    try {
      await updateManifestStatus(manifestId, status, itemStatus, token);
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update manifest.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}

      {!showForm && (
        <div>
          <Button onClick={() => setShowForm(true)} variant="navy">New manifest</Button>
        </div>
      )}

      {showForm && (
        <Card className="p-6">
          <h3 className="mb-4 font-bold text-ink">Create manifest</h3>
          <form onSubmit={handleCreateManifest} className="grid gap-3 md:grid-cols-2">
            <select value={form.schedule_id} onChange={(e) => setForm({ ...form, schedule_id: e.target.value })} className={selectCls + ' w-full'}>
              <option value="">Schedule (optional)</option>
              {schedules.map((s) => <option key={s.id} value={s.id}>{s.origin_city} → {s.destination_city}</option>)}
            </select>
            <Input value={form.coach_number} onChange={(e) => setForm({ ...form, coach_number: e.target.value })} placeholder="Coach / bus number" />
            <Input value={form.origin_city} onChange={(e) => setForm({ ...form, origin_city: e.target.value })} placeholder="Origin city" />
            <Input value={form.destination_city} onChange={(e) => setForm({ ...form, destination_city: e.target.value })} placeholder="Destination city" />
            <div className="flex gap-3 md:col-span-2">
              <Button type="submit">Create</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <Card><CardLoader /></Card>
      ) : !manifests?.length ? (
        <p className="text-sm text-muted-foreground">No manifests yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {manifests?.map((m: BusManifest) => (
            <Card key={m.id} className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-ink">{m.manifest_number || m.id.slice(0, 8)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.origin_city || '—'} → {m.destination_city || '—'} · {m.operator_name || 'no operator'} · coach {m.coach_number || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={m.status} />
                  {m.status !== 'arrived' && (
                    <Button size="sm" onClick={() => handleScan(m.id, m.status === 'in_preparation' ? 'in_transit' : 'arrived', m.status === 'in_preparation' ? 'in_transit' : 'arrived')}>
                      {m.status === 'in_preparation' ? 'Depart' : 'Arrive'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <Input
                  value={itemForm[m.id]?.order_id || ''}
                  onChange={(e) => setItemForm({ ...itemForm, [m.id]: { ...itemForm[m.id], order_id: e.target.value } })}
                  placeholder="Order UUID to add"
                  className="flex-1"
                />
                <Button type="button" variant="navy" onClick={() => handleAddItem(m.id, itemForm[m.id]?.order_id || '', itemForm[m.id]?.crate || '')}>
                  Add crate
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className={thCls}>Crate</th>
                      <th className={thCls}>Order</th>
                      <th className={thCls}>Scan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.items.map((i) => (
                      <tr key={i.id} className={rowCls}>
                        <td className={`${tdCls} font-mono text-xs`}>{i.crate_label || '—'}</td>
                        <td className={`${tdCls} font-mono text-xs text-muted-foreground`}>{i.tracking_number || i.order_id?.slice(0, 8) || '—'}</td>
                        <td className={tdCls}><StatusBadge status={i.scan_status} /></td>
                      </tr>
                    ))}
                    {!m.items.length && <tr><td colSpan={3} className="py-3 text-xs text-muted-foreground">No crates on this manifest yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================== WALLETS ==============================

export function WalletsTab({ token }: { token: string }) {
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [lockReason, setLockReason] = useState('');
  const [recon, setRecon] = useState({ expected: '', actual: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { data: wallets, loading } = useApi((t) => listWallets(t), token, reload);

  useEffect(() => {
    if (selected) {
      listWalletTransactions(selected, token).then(setTxns).catch(() => setTxns([]));
    }
  }, [selected, token, reload]);

  async function handleLock(w: Wallet, lock: boolean) {
    setBusy(true);
    setError('');
    try {
      await setWalletLock(w.id, lock, lock ? lockReason || 'Manual lock by admin' : undefined, token);
      setLockReason('');
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update wallet.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReconcile(w: Wallet) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await reconcileWallet(w.id, Number(recon.expected) || 0, Number(recon.actual) || 0, recon.notes || undefined, token);
      setNotice(
        res.status === 'mismatched'
          ? `Mismatch of ${res.difference} — wallet auto-locked.`
          : 'Wallet reconciled — matched.'
      );
      setRecon({ expected: '', actual: '', notes: '' });
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reconcile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 animate-fade-in">
      <Card className="overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h3 className="font-bold text-ink">Seller wallets</h3>
        </div>
        {loading ? (
          <CardLoader />
        ) : (
          <div className="divide-y divide-border">
            {wallets?.map((w: Wallet) => (
              <div key={w.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm font-semibold text-ink">{w.company_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {w.wallet_balance.toLocaleString()} PKR
                    {w.wallet_locked && <span className="font-semibold text-danger"> · locked{w.wallet_lock_reason ? `: ${w.wallet_lock_reason}` : ''}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-navy" onClick={() => setSelected(selected === w.id ? null : w.id)}>
                    {selected === w.id ? 'Hide' : 'Details'}
                  </Button>
                  <Button
                    size="sm"
                    variant={w.wallet_locked ? 'success' : 'danger'}
                    onClick={() => handleLock(w, !w.wallet_locked)}
                    disabled={busy}
                  >
                    {w.wallet_locked ? 'Unlock' : 'Lock'}
                  </Button>
                </div>
              </div>
            ))}
            {!wallets?.length && <p className="p-6 text-sm text-muted-foreground">No seller accounts yet.</p>}
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-5">
        {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}
        {notice && <div className="rounded-lg border border-success/30 bg-[#EAF7EF] px-4 py-3 text-sm text-success">{notice}</div>}

        <Card className="p-6">
          <h3 className="mb-1 font-bold text-ink">Reconcile wallet</h3>
          <p className="mb-4 text-xs text-muted-foreground">Expected vs actual COD payouts. A mismatch auto-locks the wallet.</p>
          <div className="grid grid-cols-2 gap-3">
            <Input value={recon.expected} onChange={(e) => setRecon({ ...recon, expected: e.target.value })} placeholder="Expected amount" />
            <Input value={recon.actual} onChange={(e) => setRecon({ ...recon, actual: e.target.value })} placeholder="Actual (wallet) amount" />
          </div>
          <Input value={recon.notes} onChange={(e) => setRecon({ ...recon, notes: e.target.value })} placeholder="Notes" className="mt-3" />
          <Button
            variant="default"
            onClick={() => selected && handleReconcile(wallets!.find((w) => w.id === selected)!)}
            disabled={!selected || busy}
            className="mt-3"
          >
            {selected ? 'Reconcile selected wallet' : 'Select a wallet first'}
          </Button>
        </Card>

        {selected && (
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-ink">Wallet transactions</h3>
              <Input
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="Lock reason (optional)"
                className="w-56"
              />
            </div>
            {txns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {txns.map((t) => (
                      <tr key={t.id} className={rowCls}>
                        <td className={`${tdCls} text-xs text-muted-foreground`}>{t.transaction_type?.replace(/_/g, ' ')}</td>
                        <td className={`${tdCls} font-semibold`}>{t.amount > 0 ? '+' : ''}{t.amount}</td>
                        <td className={`${tdCls} text-xs text-muted-foreground`}>{t.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================== RNP NETWORK ==============================

export function RnpTab({ token }: { token: string }) {
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const { data: partners, loading } = useApi((t) => listRNP(t, filter || undefined), token, reload);

  async function handleStatus(id: string, status: string) {
    try {
      await setRNPStatus(id, status, token);
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update RNP.');
    }
  }

  const pills = ['', 'pending', 'approved', 'suspended'];

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}
      <div className="flex gap-2">
        {pills.map((f) => (
          <Button
            key={f || 'all'}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f === '' ? 'All' : f}
          </Button>
        ))}
      </div>
      <Card className="overflow-hidden">
        {loading ? (
          <CardLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={thCls}>Shop</th>
                  <th className={thCls}>Owner</th>
                  <th className={thCls}>City</th>
                  <th className={thCls}>Phone</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {partners?.map((p: RNP) => (
                  <tr key={p.id} className={rowCls}>
                    <td className={`${tdCls} font-semibold text-ink`}>{p.shop_name}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{p.owner_name || '—'}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{p.city || '—'}</td>
                    <td className={`${tdCls} text-muted-foreground`}>{p.phone}</td>
                    <td className={tdCls}><StatusBadge status={p.status} /></td>
                    <td className={tdCls}>
                      {p.status === 'pending' && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-success" onClick={() => handleStatus(p.id, 'approved')}>
                          Approve
                        </Button>
                      )}
                      {p.status === 'approved' && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={() => handleStatus(p.id, 'suspended')}>
                          Suspend
                        </Button>
                      )}
                      {p.status === 'suspended' && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-success" onClick={() => handleStatus(p.id, 'approved')}>
                          Reactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!partners?.length && <tr><td colSpan={6} className="p-6 text-sm text-muted-foreground">No RNP partners registered yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================== DISCOUNTS ==============================

export function DiscountsTab({ token }: { token: string }) {
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    code: '',
    description: '',
    discount_type: 'percentage',
    value: '',
    max_discount_amount: '',
    min_order_value: '',
    is_auto_applied: false,
    max_uses: '',
  });
  const { data: discounts, loading } = useApi((t) => listDiscounts(t), token, reload);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createDiscount(
        {
          title: form.title,
          code: form.code || null,
          description: form.description || null,
          discount_type: form.discount_type,
          value: Number(form.value),
          max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
          min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
          requires_login: true,
          is_auto_applied: form.is_auto_applied,
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          is_active: true,
        },
        token
      );
      setForm({ title: '', code: '', description: '', discount_type: 'percentage', value: '', max_discount_amount: '', min_order_value: '', is_auto_applied: false, max_uses: '' });
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create discount.');
    }
  }

  async function handleToggle(d: Discount) {
    try {
      await toggleDiscount(d.id, !d.is_active, token);
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not toggle discount.');
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 animate-fade-in">
      <Card className="p-6">
        <h3 className="mb-1 font-bold text-ink">New discount</h3>
        <p className="mb-4 text-xs text-muted-foreground">Login-required by default — only signed-in users can redeem it.</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Title (e.g. First shipment 10% off)" />
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Promo code (optional)" />
          </div>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
          <div className="grid grid-cols-3 gap-3">
            <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className={selectCls + ' w-full'}>
              <option value="percentage">%</option>
              <option value="flat">Flat PKR</option>
            </select>
            <Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required placeholder="Value" />
            <Input value={form.max_discount_amount} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })} placeholder="Max cap" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: e.target.value })} placeholder="Min order value" />
            <Input value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Max uses (optional)" />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.is_auto_applied} onChange={(e) => setForm({ ...form, is_auto_applied: e.target.checked })} className="accent-[#F2701A]" />
            Auto-apply to first-time customers (signup bonus)
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="navy">Create discount</Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h3 className="font-bold text-ink">Active discounts</h3>
        </div>
        {loading ? (
          <CardLoader />
        ) : (
          <div className="divide-y divide-border">
            {discounts?.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm font-semibold text-ink">{d.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.discount_type === 'percentage' ? `${d.value}% off` : `${d.value} PKR off`}
                    {d.code ? ` · code ${d.code}` : ' · auto-applied'}
                    {d.requires_login ? ' · login required' : ''}
                    {' · '}{d.uses_count ?? 0}/{d.max_uses ?? '∞'} used
                  </p>
                </div>
                <Button size="sm" variant={d.is_active ? 'success' : 'secondary'} onClick={() => handleToggle(d)}>
                  {d.is_active ? 'Active' : 'Paused'}
                </Button>
              </div>
            ))}
            {!discounts?.length && <p className="p-6 text-sm text-muted-foreground">No discounts yet.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}