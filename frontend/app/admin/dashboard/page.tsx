'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { GoogleMap, MapPinData } from '@/components/GoogleMap';
import { ApiError, AdminAnalytics, CorridorMapHub, getAdminAnalytics, getCorridorMap } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartCard } from '@/components/charts/ChartCard';
import { TrendLine } from '@/components/charts/TrendLine';
import { StatusDonut } from '@/components/charts/StatusDonut';
import { STATUS as STATUS_COLORS } from '@/components/charts/palette';
import { Package, CircleDollarSign, Truck, Users, Shield, MapPin } from 'lucide-react';

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [hubs, setHubs] = useState<CorridorMapHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([getAdminAnalytics(token), getCorridorMap(token)])
      .then(([a, h]) => { setAnalytics(a); setHubs(h); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the dashboard.'))
      .finally(() => setLoading(false));
  }, [token]);

  const money = (v: number) => `Rs ${v.toLocaleString()}`;
  const pins: MapPinData[] = hubs
    .filter((h) => h.latitude != null && h.longitude != null)
    .map((h) => ({
      id: h.id, lat: h.latitude!, lng: h.longitude!, label: h.name,
      sublabel: `${h.in_transit} in transit · ${h.total_parcels} total parcels`,
      color: h.in_transit > 0 ? '#F2650D' : '#8A94A6',
    }));

  return (
    <AdminPageShell
      title="Network Dashboard"
      description="System-wide KPIs and live hub map"
      activeHref="/admin/dashboard"
    >
      {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}

      {loading || !analytics ? (
        <div className="grid gap-5"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Total orders" value={String(analytics.total_orders)} icon={<Package className="h-5 w-5" />} tone="bg-[#EAF1FC] text-navy" />
            <Kpi label="Revenue (delivered)" value={money(analytics.total_revenue)} icon={<CircleDollarSign className="h-5 w-5" />} tone="bg-[#EAF7EF] text-success" />
            <Kpi label="RTO rate" value={`${analytics.rto_rate}%`} icon={<Shield className="h-5 w-5" />} tone="bg-[#FBF3EA] text-[#db2203]" />
            <Kpi label="COD collected" value={money(analytics.cod_collected_total)} icon={<CircleDollarSign className="h-5 w-5" />} tone="bg-[#EAF7EF] text-success" />
            <Kpi label="COD pending" value={money(analytics.cod_pending_total)} icon={<Truck className="h-5 w-5" />} tone="bg-[#FBF0DC] text-[#B9770E]" />
            <Kpi label="Active hubs" value={String(hubs.length)} icon={<Users className="h-5 w-5" />} tone="bg-[#EAF1FC] text-navy" />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#db2203]" /><CardTitle>Live corridor map</CardTitle></div>
              <CardDescription>Every active hub with its current parcel load</CardDescription>
            </CardHeader>
            <CardContent>
              <GoogleMap pins={pins} zoom={6} height={420} />
              {hubs.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {hubs.map((h) => (
                    <div key={h.id} className="rounded-lg border border-border px-3 py-2.5">
                      <div className="truncate text-sm font-semibold text-ink">{h.name}</div>
                      <div className="text-xs text-muted-foreground">{h.zone_name || '—'}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={h.in_transit > 0 ? 'warning' : 'secondary'} className="text-[0.65rem]">{h.in_transit} in transit</Badge>
                        <span className="text-[0.65rem] text-muted-foreground">{h.delivered_today} delivered today</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Revenue — last 7 days" description="Delivered orders, network-wide" empty={analytics.daily_last_7_days.length === 0}>
              <TrendLine data={analytics.daily_last_7_days} xKey="date" series={[{ key: 'revenue', label: 'Revenue' }]} valueFormatter={money} />
            </ChartCard>
            <ChartCard title="Orders by status" empty={Object.keys(analytics.status_counts).length === 0}>
              <StatusDonut
                data={Object.entries(analytics.status_counts).map(([label, value]) => ({ label: label.replace(/_/g, ' '), value }))}
                centerLabel={{ value: String(analytics.total_orders), caption: 'total orders' }}
              />
            </ChartCard>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
        <div className="mt-3 text-xl font-bold tracking-tight text-ink">{value}</div>
        <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
