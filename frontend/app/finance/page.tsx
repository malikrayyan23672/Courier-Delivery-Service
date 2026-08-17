'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import {
  ApiError,
  getFinanceDashboard,
  getFinanceAnalytics,
  getFinanceReconciliation,
  listDisputes,
  resolveDispute,
  uploadDisputeEvidence,
  listRiderWallets,
  unlockRiderWallet,
  FinanceDashboard,
  FinanceAnalytics,
  ReconciliationReport,
  Dispute,
  RiderWallet,
  mediaUrl,
} from '@/lib/api';
import { CodSettlementsTab } from '@/app/admin/components';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChartCard } from '@/components/charts/ChartCard';
import { TrendLine } from '@/components/charts/TrendLine';
import { StatusDonut } from '@/components/charts/StatusDonut';
import { ComparisonBars } from '@/components/charts/ComparisonBars';
import { STATUS as STATUS_COLORS } from '@/components/charts/palette';

type FinanceView = 'dashboard' | 'reconciliation' | 'payouts' | 'wallets' | 'disputes';

const NAV: { key: FinanceView; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'wallets', label: 'Rider Wallets' },
  { key: 'disputes', label: 'Disputes' },
];

export default function FinancePage() {
  return (
    <RoleGuard allowedRoles={['finance', 'admin', 'super_admin']}>
      <FinanceContent />
    </RoleGuard>
  );
}

function FinanceContent() {
  const { token, setToken } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<FinanceView>('dashboard');

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#db2203] bg-[#FBF3EA] px-3 py-1 rounded-full">
            Finance & COD Engine
          </span>
          <button onClick={handleLogout} className="text-sm font-semibold text-muted-foreground hover:text-navy transition-colors">
            Log out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-6">
        <div className="flex gap-1.5 border-b border-line overflow-x-auto">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                view === n.key ? 'border-orange text-[#db2203]' : 'border-transparent text-muted-foreground hover:text-ink'
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-6">
        {view === 'dashboard' && <DashboardTab token={token} />}
        {view === 'reconciliation' && <ReconciliationTab token={token} />}
        {view === 'payouts' && <CodSettlementsTab token={token} />}
        {view === 'wallets' && <RiderWalletsTab token={token} />}
        {view === 'disputes' && <DisputesTab token={token} />}
      </main>
    </div>
  );
}

/* ------------------------------- dashboard ------------------------------- */

function DashboardTab({ token }: { token: string }) {
  const [dash, setDash] = useState<FinanceDashboard | null>(null);
  const [analytics, setAnalytics] = useState<FinanceAnalytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFinanceDashboard(token), getFinanceAnalytics(token)])
      .then(([d, a]) => {
        setDash(d);
        setAnalytics(a);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load finance dashboard.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>;
  if (error) return <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>;
  if (!dash || !analytics) return null;

  const money = (v: number) => `Rs ${v.toLocaleString()}`;

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardContent className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">COD collected (all-time)</div>
          <div className="mt-1 text-2xl font-bold text-ink">{money(dash.cod_collected_total)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending payout</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: STATUS_COLORS.warning }}>{money(dash.cod_pending_payout)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paid today</div>
          <div className="mt-1 text-2xl font-bold text-success">{money(dash.cod_paid_today)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open disputes</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: dash.open_disputes > 0 ? STATUS_COLORS.critical : STATUS_COLORS.good }}>{dash.open_disputes}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rider wallets locked</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: dash.wallet_locked_riders > 0 ? STATUS_COLORS.warning : STATUS_COLORS.good }}>{dash.wallet_locked_riders}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seller wallets locked</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: dash.wallet_locked_businesses > 0 ? STATUS_COLORS.warning : STATUS_COLORS.good }}>{dash.wallet_locked_businesses}</div>
        </CardContent></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="COD collected vs paid" description="Last 14 days" empty={analytics.cod_trend.length === 0}>
            <TrendLine
              data={analytics.cod_trend}
              xKey="date"
              series={[{ key: 'collected', label: 'Collected' }, { key: 'paid', label: 'Paid out' }]}
              valueFormatter={money}
            />
          </ChartCard>
        </div>
        <ChartCard title="T+1 SLA compliance" description="Paid on/before due date">
          <StatusDonut
            data={[
              { label: 'On time', value: analytics.sla.on_time, color: STATUS_COLORS.good },
              { label: 'Late', value: analytics.sla.late, color: STATUS_COLORS.critical },
            ]}
            centerLabel={{ value: `${analytics.sla.compliance_pct}%`, caption: 'compliant' }}
          />
        </ChartCard>
      </div>
    </div>
  );
}

/* ----------------------------- reconciliation ----------------------------- */

function ReconciliationTab({ token }: { token: string }) {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFinanceReconciliation(token)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load reconciliation report.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Skeleton className="h-72 rounded-xl" />;
  if (error) return <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>;
  if (!report) return null;

  const money = (v: number) => `Rs ${v.toLocaleString()}`;
  const businessChartData = report.by_business.slice(0, 8).map((b) => ({ label: b.company_name || 'Retail', pending: b.pending, paid: b.paid }));

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <ChartCard title="Pending vs paid by seller" empty={businessChartData.length === 0}>
        <ComparisonBars
          data={businessChartData}
          categoryKey="label"
          series={[{ key: 'pending', label: 'Pending', color: STATUS_COLORS.warning }, { key: 'paid', label: 'Paid', color: STATUS_COLORS.good }]}
          valueFormatter={money}
        />
      </ChartCard>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">By seller</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ReconciliationTable rows={report.by_business.map((r) => ({ label: r.company_name || 'Retail', ...r }))} money={money} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">By corridor (zone)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ReconciliationTable rows={report.by_corridor.map((r) => ({ label: r.zone_name || 'Unzoned', ...r }))} money={money} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReconciliationTable({ rows, money }: { rows: { label: string; pending: number; paid: number }[]; money: (v: number) => string }) {
  if (rows.length === 0) return <p className="p-5 text-sm text-muted-foreground">No settlements yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending</th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              <td className="px-5 py-3">{r.label}</td>
              <td className="px-5 py-3 text-right font-semibold" style={{ color: STATUS_COLORS.warning }}>{money(r.pending)}</td>
              <td className="px-5 py-3 text-right font-semibold text-success">{money(r.paid)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ rider wallets ------------------------------ */

function RiderWalletsTab({ token }: { token: string }) {
  const [wallets, setWallets] = useState<RiderWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listRiderWallets(token)
      .then(setWallets)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load rider wallets.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function handleUnlock(riderId: string) {
    const note = window.prompt('Audit note for this unlock (e.g. "Cash deposited at hub, counted by Ali"):');
    if (!note) return;
    setUnlockingId(riderId);
    try {
      await unlockRiderWallet(riderId, note, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not unlock wallet.');
    } finally {
      setUnlockingId(null);
    }
  }

  if (loading) return <Skeleton className="h-72 rounded-xl" />;

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}
      <Card className="overflow-hidden">
        {wallets.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No riders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rider</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cash in hand</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => {
                  const pct = w.wallet_limit ? Math.min(100, (w.cod_cash_held / w.wallet_limit) * 100) : 0;
                  return (
                    <tr key={w.rider_id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-ink">{w.full_name}</div>
                        <div className="text-xs text-muted-foreground">{w.phone}</div>
                      </td>
                      <td className="px-5 py-3.5 w-56">
                        <div className="text-xs font-semibold text-ink mb-1">Rs {w.cod_cash_held.toLocaleString()} / {w.wallet_limit.toLocaleString()}</div>
                        <div className="h-1.5 rounded-full bg-line overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: w.cod_wallet_locked ? STATUS_COLORS.critical : w.cod_cash_held >= w.wallet_warning_at ? STATUS_COLORS.warning : STATUS_COLORS.good }} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {w.cod_wallet_locked ? <Badge variant="danger">Locked</Badge> : w.cod_cash_held >= w.wallet_warning_at ? <Badge variant="warning">Near limit</Badge> : <Badge variant="success">OK</Badge>}
                      </td>
                      <td className="px-5 py-3.5">
                        {(w.cod_wallet_locked || w.cod_cash_held > 0) && (
                          <Button variant="outline" size="sm" disabled={unlockingId === w.rider_id} onClick={() => handleUnlock(w.rider_id)}>
                            {unlockingId === w.rider_id ? 'Unlocking…' : 'Unlock (cash deposited)'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------- disputes --------------------------------- */

function DisputesTab({ token }: { token: string }) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listDisputes(token)
      .then(setDisputes)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load disputes.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function handleResolve(disputeId: string, accepted: boolean) {
    const note = window.prompt(`Resolution note (${accepted ? 'accepted' : 'rejected'}):`) || undefined;
    setResolvingId(disputeId);
    try {
      await resolveDispute(disputeId, accepted, note, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resolve dispute.');
    } finally {
      setResolvingId(null);
    }
  }

  async function handleUploadEvidence(d: Dispute, file: File | null) {
    if (!file) return;
    setUploadingId(d.id);
    try {
      await uploadDisputeEvidence(d.id, file, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload evidence.');
    } finally {
      setUploadingId(null);
    }
  }

  if (loading) return <Skeleton className="h-72 rounded-xl" />;

  const open = disputes.filter((d) => d.status === 'open');
  const resolved = disputes.filter((d) => d.status !== 'open');

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Open disputes</CardTitle><CardDescription>Financial hold active - blocked from payout</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No open disputes.</p>
          ) : (
            open.map((d) => (
              <div key={d.id} className="border border-line rounded-lg p-4 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-ink">{d.tracking_number || d.order_id}</div>
                    <div className="text-xs text-muted-foreground">{d.company_name || 'Retail'} · {d.reason}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={resolvingId === d.id} onClick={() => handleResolve(d.id, false)}>Reject</Button>
                    <Button size="sm" disabled={resolvingId === d.id} onClick={() => handleResolve(d.id, true)}>Resolve (release hold)</Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {d.evidence_urls.map((url) => (
                    <a key={url} href={mediaUrl(url)} target="_blank" rel="noreferrer">
                      <img src={mediaUrl(url)} alt="Dispute evidence" className="w-16 h-16 object-cover rounded-lg border border-line hover:opacity-80" />
                    </a>
                  ))}
                  {uploadingId === d.id ? (
                    <span className="text-xs text-muted-foreground">Uploading…</span>
                  ) : (
                    <label className="text-xs font-semibold text-primary cursor-pointer border border-dashed border-line rounded-lg px-3 py-2 hover:bg-muted/30">
                      + Add evidence
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadEvidence(d, e.target.files?.[0] || null)} />
                    </label>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Resolved</CardTitle></CardHeader>
        <CardContent className="p-0">
          {resolved.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Nothing resolved yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tracking</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seller</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((d) => (
                    <tr key={d.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-mono">{d.tracking_number || d.order_id}</td>
                      <td className="px-5 py-3 text-muted-foreground">{d.company_name || 'Retail'}</td>
                      <td className="px-5 py-3"><Badge variant={d.status === 'resolved' ? 'success' : 'secondary'} className="capitalize">{d.status}</Badge></td>
                      <td className="px-5 py-3">
                        {d.evidence_urls.length > 0 ? (
                          <a href={mediaUrl(d.evidence_urls[0])} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary underline">
                            {d.evidence_urls.length} file{d.evidence_urls.length > 1 ? 's' : ''}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{d.resolution_note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
