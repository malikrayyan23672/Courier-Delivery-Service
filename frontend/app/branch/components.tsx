'use client';

const PILL_COLORS: Record<string, string> = {
  gray: 'bg-line text-muted',
  amber: 'bg-[#FDF1DD] text-[#B8710A]',
  green: 'bg-[#EAF7EF] text-success',
  red: 'bg-[#FBEAE7] text-danger',
  blue: 'bg-[#EAF1FC] text-navy',
};

const STATUS_TO_COLOR: Record<string, string> = {
  Pending: 'gray', Assigned: 'amber', 'Picked Up': 'green', Failed: 'red', Ready: 'gray',
  'Out for Delivery': 'amber', Delivered: 'green', Rescheduled: 'blue', 'En Route': 'amber',
  Arrived: 'green', 'Not Started': 'gray', Present: 'green', 'On Leave': 'amber', Absent: 'red',
  Sorted: 'green', 'In Progress': 'amber', Loading: 'amber', Inbound: 'blue', Outbound: 'amber',
};

export function Pill({ status, label }: { status: string; label?: string }) {
  const color = STATUS_TO_COLOR[status] || 'gray';
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${PILL_COLORS[color]}`}>
      {label ?? status}
    </span>
  );
}

export function AvatarChip({ name }: { name: string | null }) {
  if (!name) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-line flex items-center justify-center text-xs font-bold text-muted">–</div>
        <span className="text-muted text-sm">Unassigned</span>
      </div>
    );
  }
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold flex-none">
        {initials}
      </div>
      <span className="text-sm text-ink">{name}</span>
    </div>
  );
}

export function KpiCard({
  icon, bg, label, num, trend, trendColor,
}: { icon: React.ReactNode; bg: string; label: string; num: string | number; trend: string; trendColor: string }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-4">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white mb-3" style={{ background: bg }}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-ink font-display">{num}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
      <div className="text-xs font-semibold mt-1.5" style={{ color: trendColor }}>{trend}</div>
    </div>
  );
}

export function StatStrip({ items }: { items: { num: string | number; label: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-line rounded-2xl p-5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-xl font-bold text-ink font-display">{it.num}</div>
          <div className="text-xs text-muted mt-0.5">{it.label}</div>
        </div>
      ))}
    </div>
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
