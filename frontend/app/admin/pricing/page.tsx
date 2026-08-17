'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import {
  ApiError, PricingZone, getPricingOverview, updateZonePricing,
  createPricingRule, updatePricingRule, deletePricingRule,
} from '@/lib/api';
import { Plus, Trash2, Save, ChevronDown } from 'lucide-react';

interface SlabForm {
  weight_range_min: string;
  weight_range_max: string;
  price: string;
  extra_per_kg: string;
  fuel_surcharge_percentage: string;
  tax_percentage: string;
}

const EMPTY_SLAB: SlabForm = { weight_range_min: '', weight_range_max: '', price: '', extra_per_kg: '', fuel_surcharge_percentage: '', tax_percentage: '' };

export default function AdminPricingPage() {
  const { token } = useAuth();
  const [zones, setZones] = useState<PricingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  function load() {
    if (!token) return;
    setLoading(true);
    getPricingOverview(token)
      .then(setZones)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load pricing.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  return (
    <AdminPageShell
      title="Pricing"
      description="Base rate & COD fee per corridor, plus weight-based slabs"
      activeHref="/admin/pricing"
    >
      {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : zones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No pricing zones yet — create a zone first.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {zones.map((zone) => (
            <ZoneCard
              key={zone.zone_id}
              zone={zone}
              token={token!}
              expanded={expanded === zone.zone_id}
              onToggle={() => setExpanded((e) => (e === zone.zone_id ? null : zone.zone_id))}
              onChanged={load}
              onError={setError}
            />
          ))}
        </div>
      )}
    </AdminPageShell>
  );
}

function ZoneCard({
  zone, token, expanded, onToggle, onChanged, onError,
}: {
  zone: PricingZone; token: string; expanded: boolean; onToggle: () => void; onChanged: () => void; onError: (e: string) => void;
}) {
  const [baseRate, setBaseRate] = useState(String(zone.base_rate));
  const [codFee, setCodFee] = useState(String(zone.cod_fee_percentage));
  const [savingHeader, setSavingHeader] = useState(false);
  const [showSlabForm, setShowSlabForm] = useState(false);
  const [slabForm, setSlabForm] = useState<SlabForm>(EMPTY_SLAB);
  const [savingSlab, setSavingSlab] = useState(false);

  async function saveHeader() {
    setSavingHeader(true);
    onError('');
    try {
      await updateZonePricing(zone.zone_id, { base_rate: parseFloat(baseRate), cod_fee_percentage: parseFloat(codFee) }, token);
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not update pricing.');
    } finally {
      setSavingHeader(false);
    }
  }

  async function handleAddSlab(e: React.FormEvent) {
    e.preventDefault();
    setSavingSlab(true);
    onError('');
    try {
      await createPricingRule({
        zone_id: zone.zone_id,
        weight_range_min: parseInt(slabForm.weight_range_min, 10),
        weight_range_max: parseInt(slabForm.weight_range_max, 10),
        price: parseFloat(slabForm.price),
        extra_per_kg: slabForm.extra_per_kg ? parseFloat(slabForm.extra_per_kg) : null,
        fuel_surcharge_percentage: slabForm.fuel_surcharge_percentage ? parseFloat(slabForm.fuel_surcharge_percentage) : null,
        tax_percentage: slabForm.tax_percentage ? parseFloat(slabForm.tax_percentage) : null,
      }, token);
      setSlabForm(EMPTY_SLAB);
      setShowSlabForm(false);
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not add weight slab.');
    } finally {
      setSavingSlab(false);
    }
  }

  async function handleDeleteSlab(ruleId: string) {
    if (!window.confirm('Delete this weight slab?')) return;
    try {
      await deletePricingRule(ruleId, token);
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not delete weight slab.');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-ink">{zone.name}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${zone.is_active ? 'bg-[#EAF7EF] text-success' : 'bg-muted text-muted-foreground'}`}>
              {zone.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {zone.description && <p className="text-xs text-muted-foreground">{zone.description}</p>}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[0.65rem] font-semibold uppercase text-muted-foreground">Base rate (Rs)</label>
            <input type="number" step="0.01" value={baseRate} onChange={(e) => setBaseRate(e.target.value)}
              className="h-9 w-28 rounded-lg border border-input bg-[#FBFCFE] px-2.5 text-sm outline-none focus:border-ring" />
          </div>
          <div>
            <label className="mb-1 block text-[0.65rem] font-semibold uppercase text-muted-foreground">COD fee %</label>
            <input type="number" step="0.1" value={codFee} onChange={(e) => setCodFee(e.target.value)}
              className="h-9 w-24 rounded-lg border border-input bg-[#FBFCFE] px-2.5 text-sm outline-none focus:border-ring" />
          </div>
          <button onClick={saveHeader} disabled={savingHeader}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-navy px-3 text-xs font-bold text-white transition-colors hover:bg-navy-light disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> {savingHeader ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onToggle} className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-ink hover:bg-muted">
            {zone.weight_slabs.length} slab{zone.weight_slabs.length === 1 ? '' : 's'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-5 py-4">
          {zone.weight_slabs.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Weight (g)</th>
                    <th className="py-2 pr-4">Price</th>
                    <th className="py-2 pr-4">Extra/kg</th>
                    <th className="py-2 pr-4">Fuel %</th>
                    <th className="py-2 pr-4">Tax %</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {zone.weight_slabs.map((s) => (
                    <tr key={s.id} className="border-t border-border/60">
                      <td className="py-2 pr-4 text-ink">{s.weight_range_min}–{s.weight_range_max}</td>
                      <td className="py-2 pr-4 text-ink">Rs {s.price}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.extra_per_kg ?? '—'}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.fuel_surcharge_percentage ?? '—'}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.tax_percentage ?? '—'}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => handleDeleteSlab(s.id)} className="text-muted-foreground hover:text-[#db2203]">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showSlabForm ? (
            <form onSubmit={handleAddSlab} className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-3 lg:grid-cols-6">
              <input required type="number" placeholder="Min (g)" value={slabForm.weight_range_min} onChange={(e) => setSlabForm((f) => ({ ...f, weight_range_min: e.target.value }))} className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:border-ring" />
              <input required type="number" placeholder="Max (g)" value={slabForm.weight_range_max} onChange={(e) => setSlabForm((f) => ({ ...f, weight_range_max: e.target.value }))} className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:border-ring" />
              <input required type="number" step="0.01" placeholder="Price" value={slabForm.price} onChange={(e) => setSlabForm((f) => ({ ...f, price: e.target.value }))} className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:border-ring" />
              <input type="number" step="0.01" placeholder="Extra/kg" value={slabForm.extra_per_kg} onChange={(e) => setSlabForm((f) => ({ ...f, extra_per_kg: e.target.value }))} className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:border-ring" />
              <input type="number" step="0.1" placeholder="Fuel %" value={slabForm.fuel_surcharge_percentage} onChange={(e) => setSlabForm((f) => ({ ...f, fuel_surcharge_percentage: e.target.value }))} className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:border-ring" />
              <input type="number" step="0.1" placeholder="Tax %" value={slabForm.tax_percentage} onChange={(e) => setSlabForm((f) => ({ ...f, tax_percentage: e.target.value }))} className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus:border-ring" />
              <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
                <button disabled={savingSlab} type="submit" className="rounded-lg bg-[#db2203] px-4 py-2 text-xs font-bold text-white hover:bg-[#db2203]-light disabled:opacity-50">
                  {savingSlab ? 'Adding…' : 'Add slab'}
                </button>
                <button type="button" onClick={() => setShowSlabForm(false)} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowSlabForm(true)} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add weight slab
            </button>
          )}
        </div>
      )}
    </div>
  );
}
