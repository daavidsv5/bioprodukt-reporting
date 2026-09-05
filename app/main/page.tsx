'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMainDashboard, MainCountry } from '@/hooks/useMainDashboard';
import { useGA4MonthlyCvr } from '@/hooks/useGA4MonthlyCvr';
import YearCompareBarChart from '@/components/charts/YearCompareBarChart';
import { C } from '@/lib/chartColors';
import { formatCurrency } from '@/lib/formatters';

const CURRENT_YEAR = new Date().getFullYear();

// ─── Device filter ───────────────────────────────────────────────────────────

type Device = 'all' | 'desktop' | 'mobile' | 'tablet';

const DEVICE_OPTIONS: { value: Device; label: string }[] = [
  { value: 'all',     label: 'Všechna zařízení' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile',  label: 'Mobil' },
  { value: 'tablet',  label: 'Tablet' },
];

function DeviceSelect({ value, onChange }: { value: Device; onChange: (d: Device) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as Device)}
      aria-label="Filtr zařízení"
      className="shrink-0 text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-1.5 py-1 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
    >
      {DEVICE_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function MainDashboardContent() {
  const searchParams = useSearchParams();
  const country = (searchParams.get('country') ?? 'all') as MainCountry;
  const year = Number(searchParams.get('year') ?? CURRENT_YEAR);

  const data = useMainDashboard(country, year);
  const [device, setDevice] = useState<Device>('all');
  const { data: cvrData, loading: cvrLoading } = useGA4MonthlyCvr(year, country, device);
  // error je logován v hooku do console.error pro diagnostiku
  const currency = country === 'sk' ? 'EUR' : 'CZK';
  const fc = (v: number) => formatCurrency(v, currency);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

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
        title="Hrubý zisk"
        data={data}
        dataKey="grossProfit"
        prevKey="grossProfit_prev"
        color="#16a34a"
        colorPrev="#86efac"
        formatter={fc}
        currentYear={year}
      />

      <YearCompareBarChart
        title="Počet objednávek"
        data={data}
        dataKey="orders"
        prevKey="orders_prev"
        color={C.primary}
        colorPrev={C.primaryLight}
        formatter={(v) => Math.round(v).toLocaleString('cs-CZ')}
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

      {/* Návštěvnost webu z GA4 — pouze CZ */}
      {country !== 'sk' && (
        <div>
          {cvrLoading && (
            <div className="bg-white rounded-2xl h-64 border border-slate-100 animate-pulse" />
          )}
          {!cvrLoading && cvrData && (
            <YearCompareBarChart
              title="Návštěvnost webu"
              subtitle="Zdroj: GA4 · pouze CZ"
              data={cvrData}
              dataKey="sessions"
              prevKey="sessions_prev"
              color="#1d4ed8"
              colorPrev="#93c5fd"
              formatter={(v) => Math.round(v).toLocaleString('cs-CZ')}
              currentYear={year}
              headerRight={<DeviceSelect value={device} onChange={setDevice} />}
            />
          )}
          {!cvrLoading && !cvrData && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Návštěvnost webu</h3>
              <p className="text-xs text-slate-400 mb-4">Zdroj: GA4 · pouze CZ</p>
              <div className="flex items-center justify-center h-40 text-sm text-slate-400">
                Data GA4 nejsou dostupná — zkontrolujte konzoli prohlížeče
              </div>
            </div>
          )}
        </div>
      )}

      {/* Konverzní poměr z GA4 — pouze CZ */}
      {country !== 'sk' && (
        <div>
          {cvrLoading && (
            <div className="bg-white rounded-2xl h-64 border border-slate-100 animate-pulse" />
          )}
          {!cvrLoading && cvrData && (
            <YearCompareBarChart
              title="Konverzní poměr"
              subtitle="Zdroj: GA4 · pouze CZ"
              data={cvrData}
              dataKey="cvr"
              prevKey="cvr_prev"
              color="#0891b2"
              colorPrev="#a5f3fc"
              formatter={(v) => `${v.toFixed(2)} %`}
              currentYear={year}
              isPercent
              headerRight={<DeviceSelect value={device} onChange={setDevice} />}
            />
          )}
          {!cvrLoading && !cvrData && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Konverzní poměr</h3>
              <p className="text-xs text-slate-400 mb-4">Zdroj: GA4 · pouze CZ</p>
              <div className="flex items-center justify-center h-40 text-sm text-slate-400">
                Data GA4 nejsou dostupná — zkontrolujte konzoli prohlížeče
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default function MainDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hlavní Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Měsíční přehled klíčových metrik · srovnání s předchozím rokem
        </p>
      </div>
      <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-2 gap-5">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white rounded-2xl h-64 border border-slate-100 animate-pulse" />)}</div>}>
        <MainDashboardContent />
      </Suspense>
    </div>
  );
}
