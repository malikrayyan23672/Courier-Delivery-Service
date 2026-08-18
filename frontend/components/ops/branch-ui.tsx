'use client';

import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';

const PILL_COLORS: Record<string, string> = {
  gray: 'secondary',
  amber: 'warning',
  green: 'success',
  red: 'danger',
  blue: 'info',
};

const STATUS_TO_COLOR: Record<string, string> = {
  Pending: 'gray', Assigned: 'amber', 'Picked Up': 'green', Failed: 'red', Ready: 'gray',
  'Out for Delivery': 'amber', Delivered: 'green', Rescheduled: 'blue', 'En Route': 'amber',
  Arrived: 'green', 'Not Started': 'gray', Present: 'green', 'On Leave': 'amber', Absent: 'red',
  Sorted: 'green', 'In Progress': 'amber', Loading: 'amber', Inbound: 'blue', Outbound: 'amber',
  // Raw backend order-status values (snake_case), used directly by the real
  // /hub/* API responses wired into the receiving/dispatch/aging panels.
  created: 'blue', assigned: 'amber', picked_up: 'green', in_hub: 'amber', in_transit: 'amber',
  dest_hub: 'amber', out_for_delivery: 'amber', delivered: 'green', failed: 'red', rto: 'red',
  cancelled: 'gray',
  // Manifest statuses (bus network)
  in_preparation: 'gray', arrived: 'green',
  // Bus operator statuses
  active: 'green', inactive: 'gray',
  // Dispute statuses (finance)
  open: 'amber', resolved: 'green', rejected: 'red',
  // Staff attendance statuses (real /hub/staff roster)
  present: 'green', on_leave: 'amber', absent: 'red',
};

export function Pill({ status, label }: { status: string; label?: string }) {
  const color = STATUS_TO_COLOR[status] || 'gray';
  return <Badge variant={PILL_COLORS[color] as 'success' | 'warning' | 'danger' | 'info' | 'secondary'}>{label ?? status}</Badge>;
}

export function AvatarChip({ name }: { name: string | null }) {
  if (!name) {
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-line text-muted-foreground text-xs">–</AvatarFallback>
        </Avatar>
        <span className="text-muted-foreground text-sm">Unassigned</span>
      </div>
    );
  }
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-7 w-7">
        <AvatarFallback className="bg-navy text-white text-xs font-bold">{initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm text-ink">{name}</span>
    </div>
  );
}

export function KpiCard({
  icon, bg, label, num, trend, trendColor,
}: { icon: React.ReactNode; bg: string; label: string; num: string | number; trend: string; trendColor: string }) {
  return (
    <Card className="p-4">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white mb-3" style={{ background: bg }}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-ink font-display">{num}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      <div className="text-xs font-semibold mt-1.5" style={{ color: trendColor }}>{trend}</div>
    </Card>
  );
}

export function StatStrip({ items }: { items: { num: string | number; label: string }[] }) {
  return (
    <Card className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-xl font-bold text-ink font-display">{it.num}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{it.label}</div>
        </div>
      ))}
    </Card>
  );
}

export function Toasts({ toasts }: { toasts: { id: number; msg: string }[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="bg-navy text-white text-sm font-medium px-4 py-3 rounded-lg shadow-card animate-[fadein_.2s_ease]">
          {t.msg}
        </div>
      ))}
    </div>
  );
}
