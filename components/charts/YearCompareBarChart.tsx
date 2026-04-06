'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { MonthlyPoint } from '@/hooks/useMainDashboard';

interface Props {
  title: string;
  data: MonthlyPoint[];
  dataKey: keyof MonthlyPoint;
  prevKey: keyof MonthlyPoint;
  color: string;
  colorPrev: string;
  formatter: (v: number) => string;
  currentYear: number;
  isPercent?: boolean;
}

export default function YearCompareBarChart({
  title, data, dataKey, prevKey, color, colorPrev,
  formatter, currentYear, isPercent = false,
}: Props) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => isPercent ? `${v.toFixed(1)} %` : formatter(v)}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={isPercent ? 48 : 72}
          />
          <Tooltip
            formatter={(v: unknown, name: unknown) => {
              const val = Number(v);
              return [isPercent ? `${val.toFixed(2)} %` : formatter(val), String(name)];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            cursor={{ fill: '#f8fafc' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12, color: '#64748b' }}
            iconType="square"
            iconSize={9}
          />
          <Bar
            dataKey={prevKey as string}
            name={String(currentYear - 1)}
            fill={colorPrev}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey={dataKey as string}
            name={String(currentYear)}
            fill={color}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
