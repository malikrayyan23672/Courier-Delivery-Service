'use client';

import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell, LabelList,
} from 'recharts';
import { CATEGORICAL, GRID_COLOR, AXIS_TEXT_COLOR } from './palette';

export interface BarSeries {
  key: string;
  label: string;
  color?: string;
}

/**
 * Horizontal bar comparison. Two modes:
 * - Single series (identity per category): pass one series and each bar gets
 *   the next fixed categorical color, in row order.
 * - Multi series (e.g. "this branch" vs "network average"): pass 2+ series,
 *   each series keeps one color across all rows (a legend is shown).
 */
export function ComparisonBars({
  data,
  categoryKey,
  series,
  height = 240,
  valueFormatter,
}: {
  data: Record<string, unknown>[];
  categoryKey: string;
  series: BarSeries[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const fmt = valueFormatter ?? ((v: number) => String(v));
  const singleSeries = series.length === 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT_COLOR, fontSize: 11 }} tickFormatter={fmt} />
        <YAxis
          type="category"
          dataKey={categoryKey}
          tickLine={false}
          axisLine={false}
          width={140}
          tick={{ fill: AXIS_TEXT_COLOR, fontSize: 11 }}
        />
        <Tooltip formatter={(value, name) => [fmt(Number(value)), String(name)]} contentStyle={{ borderRadius: 10, border: '1px solid #E4E8F0', fontSize: 12 }} />
        {!singleSeries && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, si) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} radius={[0, 4, 4, 0]} maxBarSize={22} fill={s.color || CATEGORICAL[si % CATEGORICAL.length]}>
            {singleSeries && !s.color && data.map((_, i) => <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />)}
            {singleSeries && <LabelList dataKey={s.key} position="right" formatter={(v: unknown) => fmt(Number(v))} style={{ fill: '#16233D', fontSize: 11, fontWeight: 600 }} />}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
