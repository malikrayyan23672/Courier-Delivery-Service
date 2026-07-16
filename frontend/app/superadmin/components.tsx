'use client';

import React from 'react';

// ============================================================
// PILL — status / label badge. Accepts either a semantic color key
// (green/amber/red/blue/gray) or a raw status string, which it maps
// to a color automatically so callers can pass backend status text
// straight through (e.g. "in_transit", "Assigned", "Failed").
// ============================================================
const STATUS_COLOR_MAP: Record<string, string> = {
  green: 'green', success: 'green', active: 'green', delivered: 'green', online: 'green', approved: 'green',
  amber: 'amber', pending: 'amber', 'picked up': 'amber', busy: 'amber', 'en route': 'amber', review: 'amber',
  red: 'red', danger: 'red', failed: 'red', cancelled: 'red', suspended: 'red', offline: 'gray',
  blue: 'blue', assigned: 'blue', info: 'blue', 'regional hub': 'blue',
  gray: 'gray', unknown: 'gray', inactive: 'gray',
};

const COLOR_STYLES: Record<string, string> = {
  green: 'bg-[#EAF7EF] text-[#1E8E5A] border-[#1E8E5A]/25',
  amber: 'bg-[#FDF1DD] text-[#B8710A] border-[#F2A93B]/35',
  red: 'bg-[#FBEAE7] text-[#D8432C] border-[#D8432C]/25',
  blue: 'bg-[#EAF1FC] text-[#2563EB] border-[#2563EB]/25',
  gray: 'bg-page text-muted border-line',
};

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Pill({ status, label }: { status: string; label?: string }) {
  const key = status?.toLowerCase?.() ?? 'gray';
  const color = STATUS_COLOR_MAP[key] || (COLOR_STYLES[key] ? key : 'gray');
  const text = label ?? titleCase(status || '');
  return (
    <span className={`inline-flex items-center gap-1 text-[0.7rem] font-semibold px-2 py-1 rounded-full border ${COLOR_STYLES[color]}`}>
      {text}
    </span>
  );
}

// ============================================================
// AVATAR CHIP — small circular initials + name, dash if empty
// ============================================================
export function AvatarChip({ name, sub }: { name?: string | null; sub?: string }) {
  if (!name) return <span className="text-muted text-sm">—</span>;
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center font-bold text-xs flex-none">
        {initials}
      </div>
      <div>
        <div className="font-semibold text-sm text-ink leading-tight">{name}</div>
        {sub && <div className="text-xs text-muted leading-tight">{sub}</div>}
      </div>
    </div>
  );
}

// ============================================================
// KPI CARD
// ============================================================
export function KpiCard({
  icon, bg, label, num, trend, trendColor,
}: { icon: React.ReactNode; bg: string; label: string; num: React.ReactNode; trend?: string; trendColor?: string }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: bg }}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-display font-extrabold text-ink leading-none">{num}</div>
        <div className="text-xs text-muted font-semibold mt-1.5">{label}</div>
      </div>
      {trend && <div className="text-[0.7rem] font-bold" style={{ color: trendColor || '#8A94A6' }}>{trend}</div>}
    </div>
  );
}

// ============================================================
// STAT STRIP — inline row of number/label pairs
// ============================================================
export function StatStrip({ items }: { items: { num: React.ReactNode; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      {items.map((it, i) => (
        <div key={i}>
          <div className="text-xl font-display font-extrabold text-ink leading-none">{it.num}</div>
          <div className="text-xs text-muted font-semibold mt-1">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// TOASTS
// ============================================================
export function Toasts({ toasts }: { toasts: { id: number; msg: string }[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <div key={t.id} className="bg-navy text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg animate-[fadeIn_0.15s_ease-out]">
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MODAL — lightweight, used for create-user / assign-rider dialogs
// ============================================================
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-ink">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink p-1" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// FIELD — labeled form input wrapper used across create/edit modals
// ============================================================
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-ink text-xs">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full text-sm py-2.5 px-3 rounded-lg border border-line bg-page outline-none focus:border-orange";

// ============================================================
// NAV ICON — shared icon set
// ============================================================
export function NavIcon({ name, size = 16, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    truck: <><rect x="1" y="6" width="15" height="11" /><path d="M16 10h4l3 3v4h-7z" /><circle cx="6" cy="18" r="2" /><circle cx="18.5" cy="18" r="2" /></>,
    box: <><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
    warehouse: <><path d="M3 21V9l9-6 9 6v12H3z" /><path d="M9 21v-8h6v8" /></>,
    riders: <><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><path d="M2 21c0-3.5 2.5-6 6-6M22 21c0-3.5-2.5-6-6-6" /><circle cx="12" cy="15" r="3" /><path d="M6 21c0-3 2.7-5 6-5s6 2 6 5" /></>,
    staff: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
    pin: <><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
    map: <><path d="M1 6v15l7-3 8 3 7-3V3l-7 3-8-3z" /><path d="M8 3v15M16 6v15" /></>,
    reports: <><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>,
    alert: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    building: <><rect x="4" y="3" width="16" height="18" /><path d="M9 21v-4h6v4M9 8h.01M15 8h.01M9 12h.01M15 12h.01" /></>,
    zone: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" /></>,
    business: <><rect x="3" y="7" width="18" height="13" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    message: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    dollar: <><circle cx="12" cy="12" r="9" /><path d="M12 6v12M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 3 6 1.5 6 4.4 0 1.4-1.3 2.3-3 2.3s-3-1-3-2.5" /></>,
    shield: <path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.box}
    </svg>
  );
}

export function NavBadge({ n, danger }: { n: number; danger?: boolean }) {
  if (!n) return null;
  return (
    <span className={`text-[0.66rem] font-bold px-1.5 py-0.5 rounded-full ${danger ? 'bg-danger text-white' : 'bg-white/15 text-white'}`}>
      {n}
    </span>
  );
}