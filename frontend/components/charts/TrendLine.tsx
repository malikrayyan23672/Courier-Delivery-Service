'use client';

import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import { CATEGORICAL, GRID_COLOR, AXIS_TEXT_COLOR } from './palette';

export interface TrendSeries {
  key: string;
  label: string;
  color?: string;
}

export function TrendLine({
  data,
  xKey,
  series,
  height = 240,
  valueFormatter,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: TrendSeries[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const fmt = valueFormatter ?? ((v: number) => String(v));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={{ stroke: GRID_COLOR }}
          tick={{ fill: AXIS_TEXT_COLOR, fontSize: 11 }}
          tickFormatter={(v: string) => (typeof v === 'string' ? v.slice(5) : v)}
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT_COLOR, fontSize: 11 }} tickFormatter={fmt} width={48} />
        <Tooltip
          formatter={(value, name) => [fmt(Number(value)), String(name)]}
          contentStyle={{ borderRadius: 10, border: '1px solid #E4E8F0', fontSize: 12 }}
        />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color || CATEGORICAL[i % CATEGORICAL.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
