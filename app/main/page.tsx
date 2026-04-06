'use client';

import { useSearchParams } from 'next/navigation';
import { useMainDashboard, MainCountry } from '@/hooks/useMainDashboard';
import YearCompareBarChart from '@/components/charts/YearCompareBarChart';
import { C } from '@/lib/chartColors';
import { formatCurrency } from '@/lib/formatters';

const CURRENT_YEAR = new Date().getFullYear();

export default function MainDashboardPage() {
  const searchParams = useSearchParams();
  const country = (searchParams.get('country') ?? 'cz') as MainCountry;
  const year = Number(searchParams.get('year') ?? CURRENT_YEAR);

  const data = useMainDashboard(country, year);
  const currency = country === 'cz' ? 'CZK' : 'EUR';
  const fc = (v: number) => formatCurrency(v, currency);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hlavní Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Měsíční přehled klíčových metrik · srovnání s předchozím rokem
        </p>
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
