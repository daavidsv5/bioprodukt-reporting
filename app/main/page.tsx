'use client';

import { useState } from 'react';
import { useMainDashboard, MainCountry } from '@/hooks/useMainDashboard';
import YearCompareBarChart from '@/components/charts/YearCompareBarChart';
import { C } from '@/lib/chartColors';
import { formatCurrency } from '@/lib/formatters';

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from(
  { length: CURRENT_YEAR - 2023 },
  (_, i) => 2024 + i,
).reverse();

export default function MainDashboardPage() {
  const [country, setCountry] = useState<MainCountry>('cz');
  const [year, setYear] = useState<number>(CURRENT_YEAR);

  const data = useMainDashboard(country, year);
  const currency = country === 'cz' ? 'CZK' : 'EUR';
  const fc = (v: number) => formatCurrency(v, currency);

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hlavní Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Měsíční přehled klíčových metrik · srovnání s předchozím rokem
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* CZ / SK toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            {(['cz', 'sk'] as MainCountry[]).map((c, idx) => (
              <button
                key={c}
                onClick={() => setCountry(c)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
                  idx > 0 ? 'border-l border-slate-200' : ''
                } ${country === c ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {c === 'cz' ? '🇨🇿 CZ' : '🇸🇰 SK'}
              </button>
            ))}
          </div>

          {/* Rok selector */}
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {AVAILABLE_YEARS.map(y => (
              <option key={y} value={y}>{y} vs. {y - 1}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 6 grafů — 3 sloupce na xl, 2 na md */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        <YearCompareBarChart
          title="Tržby bez DPH"
          data={data}
          dataKey="revenue"
          prevKey="revenue_prev"
          color={C.primary}
          colorPrev={C.primaryLight}
          formatter={fc}
          currentYear={year}
        />

        <YearCompareBarChart
          title="Marketingové investice"
          data={data}
          dataKey="cost"
          prevKey="cost_prev"
          color={C.cost}
          colorPrev={C.costLight}
          formatter={fc}
          currentYear={year}
        />

        <YearCompareBarChart
          title="PNO (%)"
          data={data}
          dataKey="pno"
          prevKey="pno_prev"
          color={C.rate}
          colorPrev={C.rateLight}
          formatter={(v) => `${v.toFixed(2)} %`}
          currentYear={year}
          isPercent
        />

        <YearCompareBarChart
          title="AOV – Průměrná hodnota objednávky"
          data={data}
          dataKey="aov"
          prevKey="aov_prev"
          color={C.aov}
          colorPrev="#a5b4fc"
          formatter={fc}
          currentYear={year}
        />

        <YearCompareBarChart
          title="Marže (%)"
          data={data}
          dataKey="marginPct"
          prevKey="marginPct_prev"
          color={C.margin}
          colorPrev={C.marginLight}
          formatter={(v) => `${v.toFixed(2)} %`}
          currentYear={year}
          isPercent
        />

        <YearCompareBarChart
          title="Cena za objednávku (CPA)"
          data={data}
          dataKey="cpa"
          prevKey="cpa_prev"
          color={C.secondary}
          colorPrev={C.secondaryLight}
          formatter={fc}
          currentYear={year}
        />

      </div>
    </div>
  );
}
