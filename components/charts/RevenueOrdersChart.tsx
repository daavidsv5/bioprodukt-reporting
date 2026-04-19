'use client';

import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ChartDataPoint } from '@/hooks/useDashboardData';
import { formatCurrency, formatShortDate } from '@/lib/formatters';
import { Currency } from '@/data/types';
import { C } from '@/lib/chartColors';

interface Props {
  data: ChartDataPoint[];
  currency?: Currency;
  hasPrevData?: boolean;
}

function formatYAxis(v: number, currency: Currency) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${Math.round(v / 1_000)}k`;
  return String(v);
}

export default function RevenueOrdersChart({ data, currency = 'CZK', hasPrevData = true }: Props) {
  const title = hasPrevData ? 'Tržby bez DPH (YoY)' : 'Tržby bez DPH';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-5">{title}</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => formatYAxis(v, currency)}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(v: unknown, name: unknown) => [formatCurrency(Number(v), currency), String(name)]}
            labelFormatter={(l: unknown) => formatShortDate(String(l))}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, paddingTop: 16, color: '#64748b' }} />
          <Line type="monotone" dataKey="revenue" name="Tržby bez DPH (aktuální)" stroke={C.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          {hasPrevData && (
            <Line type="monotone" dataKey="revenue_prev" name="Tržby bez DPH (loňský rok)" stroke={C.primaryLight} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
