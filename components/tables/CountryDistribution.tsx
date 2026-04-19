'use client';

import { DailyRecord, Country, EUR_TO_CZK } from '@/data/types';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/formatters';

export interface CountryMargin {
  purchaseCost: number;
  marginRev: number;
}

interface Props {
  data: DailyRecord[];
  prevData?: DailyRecord[];
  hasPrevData?: boolean;
  eurToCzk?: number;
  marginCurrent?: Partial<Record<Country, CountryMargin>>;
  marginPrev?: Partial<Record<Country, CountryMargin>>;
}

interface CountryRow {
  country: Country;
  orders: number;
  revenue: number;
  revenue_vat: number;
  cost: number;
  pno: number;
  cpa: number;
  share: number;
}

const countryColors: Record<Country, string> = {
  cz: '#4285F4',
  sk: '#FF9800',
};

const countryLabels: Record<Country, string> = {
  cz: 'Česká republika (CZ)',
  sk: 'Slovensko (SK)',
};

// All values displayed in CZK — SK converted via live eurToCzk rate

function yoyPct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function YoyVal({ curr, prev, invert = false }: { curr: number; prev: number; invert?: boolean }) {
  const pct = yoyPct(curr, prev);
  if (pct === null) return null;
  const positive = invert ? pct < 0 : pct > 0;
  return (
    <span className={`block text-xs font-semibold mt-0.5 ${positive ? 'text-emerald-600' : 'text-rose-500'}`}>
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

const pnoColor = (pno: number) =>
  pno < 15 ? 'bg-emerald-50 text-emerald-700' :
  pno < 25 ? 'bg-amber-50 text-amber-700' :
  pno < 35 ? 'bg-orange-50 text-orange-700' :
  'bg-rose-50 text-rose-600';

function aggregate(records: DailyRecord[]): Record<string, CountryRow> {
  const byCountry: Record<string, CountryRow> = {};
  for (const r of records) {
    if (!byCountry[r.country]) {
      byCountry[r.country] = { country: r.country, orders: 0, revenue: 0, revenue_vat: 0, cost: 0, pno: 0, cpa: 0, share: 0 };
    }
    byCountry[r.country].orders      += r.orders;
    byCountry[r.country].revenue     += r.revenue;
    byCountry[r.country].revenue_vat += r.revenue_vat;
    byCountry[r.country].cost        += r.cost;
  }
  return byCountry;
}

export default function CountryDistribution({
  data,
  prevData = [],
  hasPrevData = false,
  eurToCzk = EUR_TO_CZK,
  marginCurrent = {},
  marginPrev = {},
}: Props) {
  const curr = aggregate(data);
  const prev = aggregate(prevData);

  const rows = (Object.values(curr) as CountryRow[]).map((r) => ({
    ...r,
    pno: r.revenue > 0 ? (r.cost / r.revenue) * 100 : 0,
    cpa: r.orders > 0 ? r.cost / r.orders : 0,
  }));

  const revenueCZK = (r: CountryRow) => r.country === 'sk' ? r.revenue * eurToCzk : r.revenue;
  const totalRevenueCZK = rows.reduce((s, r) => s + revenueCZK(r), 0);
  rows.forEach((r) => { r.share = totalRevenueCZK > 0 ? (revenueCZK(r) / totalRevenueCZK) * 100 : 0; });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Distribuce podle země</h2>
      </div>

      {/* Stacked bar */}
      <div className="px-5 py-4">
        <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
          {rows.map((r) => (
            <div
              key={r.country}
              style={{ width: `${r.share}%`, backgroundColor: countryColors[r.country] }}
              className="flex items-center justify-center text-white text-xs font-bold transition-all"
              title={`${r.country.toUpperCase()}: ${r.share.toFixed(1)}%`}
            >
              {r.share > 10 ? `${r.share.toFixed(0)}%` : ''}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          {rows.map((r) => (
            <div key={r.country} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: countryColors[r.country] }} />
              <span className="text-xs text-slate-600">{r.country.toUpperCase()} ({r.share.toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-900 border-y border-blue-800">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Země</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">Objednávky</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">Tržby bez DPH</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">Tržby s DPH</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">Náklady</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">PNO</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">CPA</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">Marže</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">Hrubý zisk</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">Hrubý zisk %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              // SK values are in EUR — multiply by live rate for CZK display
              const mult = r.country === 'sk' ? eurToCzk : 1;
              const fc = (v: number) => formatCurrency(v * mult, 'CZK');
              const p = prev[r.country];

              // Margin metrics — current (native EUR for SK → convert)
              const mCur = marginCurrent[r.country];
              const marze        = mCur ? (mCur.marginRev - mCur.purchaseCost) * mult : 0;
              const marginRevCzk = mCur ? mCur.marginRev * mult : 0;
              const marzePct     = marginRevCzk > 0 ? (marze / marginRevCzk) * 100 : 0;
              const hrubyzisk    = marze - r.cost * mult;
              const hrubyziskPct = marginRevCzk > 0 ? (hrubyzisk / marginRevCzk) * 100 : 0;

              // Margin metrics — prev (same conversion, YoY % uses same mult so it cancels)
              const mPrev = marginPrev[r.country];
              const marzePrev        = mPrev ? (mPrev.marginRev - mPrev.purchaseCost) * mult : 0;
              const prevMarginRevCzk = mPrev ? mPrev.marginRev * mult : 0;
              const hrubyziskPrev    = marzePrev - (p?.cost ?? 0) * mult;
              const hrubyziskPctPrev = prevMarginRevCzk > 0 ? (hrubyziskPrev / prevMarginRevCzk) * 100 : 0;

              return (
                <tr key={r.country} className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: countryColors[r.country] }} />
                      <span className="text-base text-slate-700 font-medium">{countryLabels[r.country]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-base text-slate-700">
                    {formatNumber(r.orders)}
                    {hasPrevData && p && <YoyVal curr={r.orders} prev={p.orders} />}
                  </td>
                  <td className="px-4 py-4 text-right text-base text-slate-700">
                    {fc(r.revenue)}
                    {hasPrevData && p && <YoyVal curr={r.revenue} prev={p.revenue} />}
                  </td>
                  <td className="px-4 py-4 text-right text-base text-slate-900 font-semibold">
                    {fc(r.revenue_vat)}
                    {hasPrevData && p && <YoyVal curr={r.revenue_vat} prev={p.revenue_vat} />}
                  </td>
                  <td className="px-4 py-4 text-right text-base text-slate-700">
                    {fc(r.cost)}
                    {hasPrevData && p && <YoyVal curr={r.cost} prev={p.cost} invert />}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className={`px-2 py-0.5 rounded-lg text-sm font-semibold ${pnoColor(r.pno)}`}>
                      {formatPercent(r.pno)}
                    </span>
                    {hasPrevData && p && (() => {
                      const prevPno = p.revenue > 0 ? (p.cost / p.revenue) * 100 : 0;
                      return <YoyVal curr={r.pno} prev={prevPno} invert />;
                    })()}
                  </td>
                  <td className="px-4 py-4 text-right text-base text-slate-700">
                    {fc(r.cpa)}
                    {hasPrevData && p && (() => {
                      const prevCpa = p.orders > 0 ? p.cost / p.orders : 0;
                      return <YoyVal curr={r.cpa} prev={prevCpa} invert />;
                    })()}
                  </td>
                  <td className="px-4 py-4 text-right text-base text-slate-700">
                    {mCur ? fc(marze / mult) : '–'}
                    {hasPrevData && mPrev && <YoyVal curr={marze} prev={marzePrev} />}
                  </td>
                  <td className="px-4 py-4 text-right text-base text-slate-700">
                    {mCur ? fc(hrubyzisk / mult) : '–'}
                    {hasPrevData && mPrev && <YoyVal curr={hrubyzisk} prev={hrubyziskPrev} />}
                  </td>
                  <td className="px-4 py-4 text-right text-base text-slate-700">
                    {mCur ? formatPercent(hrubyziskPct) : '–'}
                    {hasPrevData && mPrev && <YoyVal curr={hrubyziskPct} prev={hrubyziskPctPrev} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
