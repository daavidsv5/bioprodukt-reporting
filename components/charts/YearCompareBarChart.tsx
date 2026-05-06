'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

interface Props {
  title: string;
  subtitle?: string;
  data: { label: string }[];
  dataKey: string;
  prevKey: string;
  color: string;
  colorPrev: string;
  formatter: (v: number) => string;
  currentYear: number;
  isPercent?: boolean;
}

export default function YearCompareBarChart({
  title, subtitle, data, dataKey, prevKey, color, colorPrev,
  formatter, currentYear, isPercent = false,
}: Props) {
  const fmt = (v: number) => isPercent ? `${v.toFixed(2)} %` : formatter(v);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
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
            cursor={{ fill: '#f8fafc' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;

              const cur = payload.find(e => e.name === String(currentYear));
              const prev = payload.find(e => e.name === String(currentYear - 1));

              let yoyPct: number | null = null;
              if (cur?.value != null && prev?.value != null && Number(prev.value) !== 0) {
                yoyPct = ((Number(cur.value) - Number(prev.value)) / Math.abs(Number(prev.value))) * 100;
              }

              return (
                <div style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  minWidth: 160,
                }}>
                  <p style={{ fontWeight: 600, marginBottom: 6, color: '#334155' }}>{label}</p>
                  {[prev, cur].map(e => e && (
                    <p key={e.name as string} style={{ color: e.fill as string, margin: '2px 0' }}>
                      {e.name}: {fmt(Number(e.value))}
                    </p>
                  ))}
                  {yoyPct !== null && (
                    <p style={{
                      marginTop: 6,
                      paddingTop: 5,
                      borderTop: '1px solid #f1f5f9',
                      fontWeight: 700,
                      color: yoyPct >= 0 ? '#16a34a' : '#dc2626',
                    }}>
                      YoY: {yoyPct >= 0 ? '+' : ''}{yoyPct.toFixed(1)} %
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12, color: '#64748b' }}
            iconType="square"
            iconSize={9}
          />
          <Bar
            dataKey={prevKey}
            name={String(currentYear - 1)}
            fill={colorPrev}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey={dataKey}
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
