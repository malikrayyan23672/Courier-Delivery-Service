'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import {
  ApiError,
  getSellerMe,
  getSellerSettlements,
  getSellerSettlementSummary,
  getSellerTransactions,
  getSellerAnalytics,
  uploadSellerFile,
  listSellerUploads,
  registerRNP,
  listSellerRNP,
  SellerMe,
  SellerSettlement,
  SellerUpload,
  WalletTransaction,
  RNP,
  SellerAnalytics,
} from '@/lib/api';
import { ChartCard } from '@/components/charts/ChartCard';
import { TrendLine } from '@/components/charts/TrendLine';
import { StatusDonut } from '@/components/charts/StatusDonut';
import { STATUS as STATUS_COLORS } from '@/components/charts/palette';

type View = 'overview' | 'analytics' | 'settlements' | 'files' | 'rnp';

export default function SellerPage() {
  return (
    <RoleGuard allowedRoles={['business']}>
      <SellerContent />
    </RoleGuard>
  );
}

function SellerContent() {
  const { token, setToken } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<View>('overview');

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  const NAV: { key: View; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'settlements', label: 'COD Payouts' },
    { key: 'files', label: 'Bulk Orders' },
    { key: 'rnp', label: 'RNP Points' },
  ];

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-orange bg-[#FBF3EA] px-3 py-1 rounded-full">
            Seller Portal
          </span>
          <button onClick={handleLogout} className="text-sm font-semibold text-muted-foreground hover:text-navy transition-colors">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        <div className="flex gap-2 mb-6 border-b border-line overflow-x-auto">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                view === n.key ? 'border-orange text-orange' : 'border-transparent text-muted-foreground hover:text-ink'
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>

        {view === 'overview' && <OverviewTab token={token!} onNavigate={setView} />}
        {view === 'analytics' && <AnalyticsTab token={token!} />}
        {view === 'settlements' && <SettlementsTab token={token!} />}
        {view === 'files' && <FilesTab token={token!} />}
        {view === 'rnp' && <RnpTab token={token!} />}
      </main>
    </div>
  );
}

function OverviewTab({ token, onNavigate }: { token: string; onNavigate: (v: View) => void }) {
  const [me, setMe] = useState<SellerMe | null>(null);
  const [summary, setSummary] = useState<{ pending_count: number; pending_amount: number } | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getSellerMe(token), getSellerSettlementSummary(token), getSellerTransactions(token)])
      .then(([m, s, t]) => {
        setMe(m);
        setSummary(s);
        setTxns(t);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your account.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-muted-foreground text-sm">Loading your portal…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!me) return null;

  return (
    <div>
      {!me.verified && (
        <div className="mb-6 bg-[#FBF3EA] border border-orange/20 rounded-card px-5 py-3 text-sm text-orange font-semibold">
          Your phone number is not verified yet — please verify via OTP to fully activate your seller account.
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wallet balance</p>
          <p className="text-2xl font-bold text-ink mt-1">{(me.wallet_balance || 0).toLocaleString()} PKR</p>
          {me.wallet_locked && (
            <p className="text-xs text-danger font-semibold mt-1">
              Wallet locked{me.wallet_lock_reason ? ` · ${me.wallet_lock_reason}` : ''}
            </p>
          )}
        </div>
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending COD payouts</p>
          <p className="text-2xl font-bold text-ink mt-1">{(summary?.pending_amount || 0).toLocaleString()} PKR</p>
          <p className="text-xs text-muted-foreground mt-1">{summary?.pending_count ?? 0} orders · T+1 next-morning payout</p>
        </div>
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business</p>
          <p className="text-lg font-bold text-ink mt-1 truncate">{me.company_name}</p>
          <p className="text-xs text-muted-foreground mt-1">{me.business_type || '—'} · COD {me.cod_service ? 'enabled' : 'disabled'}</p>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h3 className="font-bold text-ink">Recent wallet activity</h3>
          <button onClick={() => onNavigate('settlements')} className="text-sm font-semibold text-orange hover:text-orange-light">
            View payouts
          </button>
        </div>
        {txns.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">No wallet transactions yet. COD payouts appear here after settlement.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {txns.slice(0, 8).map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3.5 text-muted-foreground capitalize">{t.transaction_type?.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-3.5 font-semibold text-ink">
                    <span className={t.amount >= 0 ? 'text-success' : 'text-danger'}>
                      {t.amount >= 0 ? '+' : ''}{t.amount}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground text-xs">{t.reference || '—'}</td>
                  <td className="px-6 py-3.5 text-muted-foreground text-xs">
                    {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
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
  const [data, setData] = useState<SellerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSellerAnalytics(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load analytics.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-muted-foreground text-sm">Loading analytics…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return null;

  const statusData = Object.entries(data.status_counts).map(([status, value]) => ({ label: status.replace(/_/g, ' '), value }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total shipments</p>
          <p className="text-2xl font-bold text-ink mt-1">{data.total_shipments}</p>
        </div>
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">RTO rate</p>
          <p className="text-2xl font-bold mt-1" style={{ color: data.rto_rate > 15 ? STATUS_COLORS.critical : STATUS_COLORS.good }}>{data.rto_rate}%</p>
        </div>
      </div>

      <ChartCard title="Shipments — last 14 days" empty={data.daily_shipments.length === 0} emptyMessage="No shipments in this period yet.">
        <TrendLine data={data.daily_shipments} xKey="date" series={[{ key: 'shipments', label: 'Shipments' }]} />
      </ChartCard>

      <ChartCard title="Shipments by status" empty={statusData.length === 0}>
        <StatusDonut data={statusData} centerLabel={{ value: String(data.total_shipments), caption: 'shipments' }} />
      </ChartCard>
    </div>
  );
}

function SettlementsTab({ token }: { token: string }) {
  const [rows, setRows] = useState<SellerSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSellerSettlements(token)
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load payouts.'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <h3 className="font-bold text-ink">COD payouts — guaranteed next morning (T+1)</h3>
      </div>
      {loading ? (
        <p className="p-6 text-muted-foreground text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-muted-foreground text-sm">No COD payouts yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted-foreground">
              <th className="px-6 py-3 font-semibold">Tracking</th>
              <th className="px-6 py-3 font-semibold">Amount</th>
              <th className="px-6 py-3 font-semibold">Due (T+1)</th>
              <th className="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="px-6 py-3.5 font-mono">{s.tracking_number || '—'}</td>
                <td className="px-6 py-3.5 font-semibold">{s.amount.toLocaleString()} PKR</td>
                <td className="px-6 py-3.5 text-muted-foreground">
                  {s.settle_due_on ? new Date(s.settle_due_on).toDateString() : '—'}
                </td>
                <td className="px-6 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    s.status === 'paid' ? 'bg-[#EAF7EF] text-success' : 'bg-[#FBF3EA] text-orange'
                  }`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FilesTab({ token }: { token: string }) {
  const [uploads, setUploads] = useState<SellerUpload[]>([]);
  const [selected, setSelected] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() {
    listSellerUploads(token)
      .then(setUploads)
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      await uploadSellerFile(selected, token);
      setNotice(`Uploaded ${selected.name}. The AI platform will parse it into draft orders.`);
      setSelected(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-card shadow-card p-6">
        <h3 className="font-bold text-ink mb-1">Upload bulk orders</h3>
        <p className="text-xs text-muted-foreground mb-4">CSV, Excel, or Word file of your orders. Raftaar&apos;s AI platform parses them into draft shipments.</p>
        <form onSubmit={handleUpload} className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-[14px] px-6 py-8 text-center cursor-pointer hover:border-orange transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted-foreground">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm font-semibold text-ink">{selected ? selected.name : 'Click to choose a file'}</span>
            <span className="text-xs text-muted-foreground">.csv · .xlsx · .xls · .doc · .docx (max 25MB)</span>
            <input type="file" accept=".csv,.xlsx,.xls,.doc,.docx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => setSelected(e.target.files?.[0] || null)} />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          {notice && <p className="text-sm text-success">{notice}</p>}
          <button disabled={!selected || uploading} className="w-full text-sm font-bold px-5 py-3 rounded-[10px] bg-orange text-white hover:bg-orange-light disabled:opacity-50 transition-colors">
            {uploading ? 'Uploading…' : 'Upload file'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <h3 className="font-bold text-ink">Your uploads</h3>
        </div>
        {uploads.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">No files uploaded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3.5 font-semibold text-ink">{u.original_filename}</td>
                  <td className="px-6 py-3.5 uppercase text-muted-foreground text-xs">{u.file_type || '—'}</td>
                  <td className="px-6 py-3.5 text-muted-foreground text-xs">{u.status}</td>
                  <td className="px-6 py-3.5 text-muted-foreground text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
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

function RnpTab({ token }: { token: string }) {
  const [partners, setPartners] = useState<RNP[]>([]);
  const [form, setForm] = useState({ shop_name: '', owner_name: '', phone: '', city: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() {
    listSellerRNP(token).then(setPartners).catch(() => {});
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await registerRNP(form, token);
      setNotice('RNP partner registered — awaiting admin approval.');
      setForm({ shop_name: '', owner_name: '', phone: '', city: '', address: '' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register RNP.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-card shadow-card p-6">
        <h3 className="font-bold text-ink mb-1">Register an RNP point</h3>
        <p className="text-xs text-muted-foreground mb-4">Raftaar Neighbourhood Points — local shops as your drop-off / pick-up nodes.</p>
        <form onSubmit={handleRegister} className="space-y-3">
          <input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} required placeholder="Shop name" className="w-full text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE]" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Owner name" className="text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE]" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="Phone" className="text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE]" />
          </div>
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="w-full text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE]" />
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="w-full text-sm py-2.5 px-3 rounded-[10px] border border-line bg-[#FBFCFE]" />
          {error && <p className="text-sm text-danger">{error}</p>}
          {notice && <p className="text-sm text-success">{notice}</p>}
          <button disabled={submitting} className="w-full text-sm font-bold px-5 py-3 rounded-[10px] bg-navy text-white hover:bg-navy-light disabled:opacity-50 transition-colors">
            {submitting ? 'Registering…' : 'Register RNP'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <h3 className="font-bold text-ink">Your RNP points</h3>
        </div>
        {partners.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">No RNP points registered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3.5 font-semibold text-ink">{p.shop_name}</td>
                  <td className="px-6 py-3.5 text-muted-foreground">{p.city || '—'}</td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      p.status === 'approved' ? 'bg-[#EAF7EF] text-success' : p.status === 'suspended' ? 'bg-[#FBEAE7] text-danger' : 'bg-[#FBF3EA] text-orange'
                    }`}>
                      {p.status}
                    </span>
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