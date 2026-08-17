'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { ApiError, AuditLogEntry, listAuditLogs } from '@/lib/api';
import { Search, ShieldCheck } from 'lucide-react';

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminAuditLogPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [entityType, setEntityType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    listAuditLogs(token, {
      q: q || undefined,
      entity_type: entityType || undefined,
      from_date: fromDate ? `${fromDate}T00:00:00` : undefined,
      to_date: toDate ? `${toDate}T23:59:59` : undefined,
    })
      .then(setLogs)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the audit log.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  const entityTypes = Array.from(new Set(logs.map((l) => l.entity_type))).sort();

  return (
    <AdminPageShell
      title="Audit Log"
      description="Immutable record of every administrative action — searchable by user, entity and date"
      activeHref="/admin/audit-log"
    >
      <form onSubmit={handleFilterSubmit} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-[0.65rem] font-semibold uppercase text-muted-foreground">Search action / details</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. seller_approved, zone_pricing_updated…"
              className="h-9 w-full rounded-lg border border-input bg-[#FBFCFE] pl-9 pr-3 text-sm outline-none focus:border-ring" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[0.65rem] font-semibold uppercase text-muted-foreground">Entity type</label>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}
            className="h-9 rounded-lg border border-input bg-[#FBFCFE] px-2.5 text-sm outline-none focus:border-ring">
            <option value="">Any</option>
            {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[0.65rem] font-semibold uppercase text-muted-foreground">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="h-9 rounded-lg border border-input bg-[#FBFCFE] px-2.5 text-sm outline-none focus:border-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[0.65rem] font-semibold uppercase text-muted-foreground">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="h-9 rounded-lg border border-input bg-[#FBFCFE] px-2.5 text-sm outline-none focus:border-ring" />
        </div>
        <button type="submit" className="h-9 rounded-lg bg-navy px-4 text-xs font-bold text-white transition-colors hover:bg-navy-light">
          Apply filters
        </button>
      </form>

      {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No actions match these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-ink">{l.user.full_name || 'System'}</div>
                    <div className="text-xs text-muted-foreground">{l.user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#EAF1FC] px-2.5 py-1 text-xs font-bold text-navy">{titleCase(l.action)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {l.entity_type}
                    <span className="ml-1 font-mono text-[0.65rem] text-muted-foreground/70">{l.entity_id.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{l.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
