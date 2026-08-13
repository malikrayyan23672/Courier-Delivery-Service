'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { CATEGORICAL } from './palette';

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

export function StatusDonut({
  data,
  height = 220,
  centerLabel,
  valueFormatter,
}: {
  data: DonutSlice[];
  height?: number;
  centerLabel?: { value: string; caption: string };
  valueFormatter?: (v: number) => string;
}) {
  const fmt = valueFormatter ?? ((v: number) => String(v));
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={2} strokeWidth={2} stroke="#FFFFFF">
            {data.map((d, i) => (
              <Cell key={d.label} fill={d.color || CATEGORICAL[i % CATEGORICAL.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [fmt(Number(value)), String(name)]} contentStyle={{ borderRadius: 10, border: '1px solid #E4E8F0', fontSize: 12 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" style={{ marginBottom: 24 }}>
          <span className="font-display text-xl font-bold text-ink">{centerLabel.value}</span>
          <span className="text-[0.65rem] text-muted-foreground">{centerLabel.caption}</span>
        </div>
      )}
    </div>
  );
}
