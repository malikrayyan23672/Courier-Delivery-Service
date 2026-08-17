'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { ApiError, Corridor, listCorridors, createCorridor, updateCorridor } from '@/lib/api';
import { Plus, MapPinned, X } from 'lucide-react';

function DeliveryRateBadge({ rate }: { rate: number }) {
  const tone = rate >= 90 ? 'bg-[#EAF7EF] text-success' : rate >= 70 ? 'bg-[#FBF3EA] text-[#db2203]' : 'bg-[#FBE9E5] text-[#db2203]';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{rate}%</span>;
}

interface FormState {
  origin: string;
  destination: string;
  distance_km: string;
  estimated_time_min: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = { origin: '', destination: '', distance_km: '', estimated_time_min: '', is_active: true };

export default function AdminCorridorsPage() {
  const { token } = useAuth();
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    if (!token) return;
    setLoading(true);
    listCorridors(token)
      .then(setCorridors)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load corridors.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(c: Corridor) {
    setEditingId(c.id);
    setForm({
      origin: c.origin, destination: c.destination,
      distance_km: String(c.distance_km), estimated_time_min: String(c.estimated_time_min),
      is_active: c.is_active,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        distance_km: parseInt(form.distance_km, 10) || 0,
        estimated_time_min: parseInt(form.estimated_time_min, 10) || 0,
        is_active: form.is_active,
      };
      if (editingId) {
        await updateCorridor(editingId, payload, token);
      } else {
        await createCorridor(payload, token);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save corridor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminPageShell
      title="Corridors"
      description="Active city-to-city corridors with live performance metrics"
      activeHref="/admin/corridors"
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{corridors.length} corridor{corridors.length === 1 ? '' : 's'}</p>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-navy-light"
        >
          <Plus className="h-4 w-4" /> New corridor
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}

      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">{editingId ? 'Edit corridor' : 'New corridor'}</h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Origin city</label>
              <input required value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                className="h-10 w-full rounded-lg border border-input bg-[#FBFCFE] px-3 text-sm outline-none focus:border-ring" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Destination city</label>
              <input required value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                className="h-10 w-full rounded-lg border border-input bg-[#FBFCFE] px-3 text-sm outline-none focus:border-ring" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Distance (km)</label>
              <input required type="number" min={1} value={form.distance_km} onChange={(e) => setForm((f) => ({ ...f, distance_km: e.target.value }))}
                className="h-10 w-full rounded-lg border border-input bg-[#FBFCFE] px-3 text-sm outline-none focus:border-ring" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Estimated time (min)</label>
              <input required type="number" min={1} value={form.estimated_time_min} onChange={(e) => setForm((f) => ({ ...f, estimated_time_min: e.target.value }))}
                className="h-10 w-full rounded-lg border border-input bg-[#FBFCFE] px-3 text-sm outline-none focus:border-ring" />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Active corridor
            </label>
            <div className="sm:col-span-2">
              <button disabled={submitting} type="submit" className="rounded-lg bg-[#db2203] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#db2203]-light disabled:opacity-50">
                {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create corridor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : corridors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <MapPinned className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No corridors yet — create the first city-to-city route.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Corridor</th>
                <th className="px-4 py-3">Distance</th>
                <th className="px-4 py-3">ETA</th>
                <th className="px-4 py-3">Base rate</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Delivered / RTO</th>
                <th className="px-4 py-3">Delivery rate</th>
                <th className="px-4 py-3">Avg. time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {corridors.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold text-ink">{c.origin} → {c.destination}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.distance_km} km</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.estimated_time_min} min</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.base_rate != null ? `Rs ${c.base_rate}` : '—'}</td>
                  <td className="px-4 py-3 text-ink">{c.total_orders}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.delivered} / {c.rto}</td>
                  <td className="px-4 py-3"><DeliveryRateBadge rate={c.delivery_rate} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{c.avg_delivery_hours != null ? `${c.avg_delivery_hours}h` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${c.is_active ? 'bg-[#EAF7EF] text-success' : 'bg-muted text-muted-foreground'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="text-xs font-semibold text-primary hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
