'use client';

import { useFilters, getDateRange } from '@/hooks/useFilters';
import { useDashboardData } from '@/hooks/useDashboardData';
import { mockData, getMarketingSourceData, getDailyMarketingData } from '@/data/mockGenerator';
import KpiCard from '@/components/kpi/KpiCard';
import { formatCurrency, formatPercent, formatNumber, formatDate, formatShortDate } from '@/lib/formatters';
import { TrendingUp as TrendingUpIcon, TrendingUp, TrendingDown, Percent, Tag, Banknote, Share2, Search, List } from 'lucide-react';
import {
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, LineChart,
} from 'recharts';
import CostPnoChart from '@/components/charts/CostPnoChart';
import { C } from '@/lib/chartColors';

function yoyPct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function YoyBadge({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null || pct === 0) return null;
  const positive = invert ? pct < 0 : pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-md ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

function pnoColor(pno: number): string {
  if (pno < 15) return 'bg-green-100 text-green-800';
  if (pno < 25) return 'bg-yellow-100 text-yellow-800';
  if (pno < 35) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}


export default function MarketingPage() {
  const { filters, eurToCzk } = useFilters();
  const { kpi, yoy, chartData, currentData, currency, hasPrevData } = useDashboardData(filters, mockData, eurToCzk);
  const fc = (v: number) => formatCurrency(v, currency);

  const { start, end } = getDateRange(filters);
  const subtitle = `${formatDate(start)} – ${formatDate(end)}`;

  const dailyCost = chartData.map((d) => d.cost);
  const dailyPno = chartData.map((d) => d.pno);
  const dailyCpa = chartData.map((d) => (d.orders > 0 ? d.cost / d.orders : 0));
  const dailyRevenue = chartData.map((d) => d.revenue);

  const kpiCards = [
    { title: 'Marketingové investice', value: fc(kpi.cost),    yoy: yoy.cost,    sparklineData: dailyCost,    invertColors: true, icon: <TrendingUpIcon size={16} /> },
    { title: 'PNO (%)',                value: formatPercent(kpi.pno), yoy: yoy.pno, sparklineData: dailyPno, invertColors: true, icon: <Percent size={16} /> },
    { title: 'Cena za objednávku',     value: fc(kpi.cpa),    yoy: yoy.cpa,     sparklineData: dailyCpa,     invertColors: true, icon: <Tag size={16} /> },
    { title: 'Tržby bez DPH',          value: fc(kpi.revenue),yoy: yoy.revenue, sparklineData: dailyRevenue, icon: <Banknote size={16} /> },
  ].map(c => ({ ...c, hasPrevData }));

  const sym = currency === 'EUR' ? '€' : 'Kč';

  // Daily marketing data — base for table + trend charts
  const { start: sDaily, end: eDaily } = getDateRange(filters);

  // Previous year bounds — defined early so they can be used below
  const prevStart = new Date(sDaily); prevStart.setFullYear(prevStart.getFullYear() - 1);
  const prevEnd   = new Date(eDaily); prevEnd.setFullYear(prevEnd.getFullYear() - 1);

  const allDailyMarketing = getDailyMarketingData(
    sDaily.toISOString().split('T')[0],
    eDaily.toISOString().split('T')[0],
    filters.countries,
    eurToCzk
  );

  const dailyRows = allDailyMarketing.slice(0, 30).map(r => ({
    ...r,
    pno: r.revenue > 0 ? (r.cost / r.revenue) * 100 : 0,
    cpa: r.orders > 0 ? r.cost / r.orders : 0,
    pno_fb: r.revenue > 0 ? (r.cost_facebook / r.revenue) * 100 : 0,
    pno_g:  r.revenue > 0 ? (r.cost_google   / r.revenue) * 100 : 0,
  }));

  // Ascending for trend charts
  const marketingAsc = [...allDailyMarketing].reverse();

  // Prev year CPC data (aligned by index)
  const prevMarketingData = hasPrevData ? getDailyMarketingData(
    prevStart.toISOString().split('T')[0],
    prevEnd.toISOString().split('T')[0],
    filters.countries,
    eurToCzk
  ).reverse() : [];

  const cpc = (cost: number, clicks: number) => clicks > 0 ? Math.round(cost / clicks * 100) / 100 : null;

  const marketingChartData = marketingAsc.map((r, i) => {
    const p = prevMarketingData[i];
    return {
      date: r.date,
      cpc_fb: cpc(r.cost_facebook, r.clicks_facebook),
      cpc_g:  cpc(r.cost_google,   r.clicks_google),
      cpc_sz: cpc(r.cost_seznam,   r.clicks_seznam),
      cpc_hk: cpc(r.cost_heureka,  r.clicks_heureka),
      cpc_fb_prev: p ? cpc(p.cost_facebook, p.clicks_facebook) : null,
      cpc_g_prev:  p ? cpc(p.cost_google,   p.clicks_google)   : null,
    };
  });

  // Source breakdown — use real data with date range + country context
  const sourceData = getMarketingSourceData(
    sDaily.toISOString().split('T')[0],
    eDaily.toISOString().split('T')[0],
    filters.countries,
    eurToCzk
  );

  // Per-channel summary metrics
  const fb = sourceData.find(s => s.source === 'Facebook Ads') ?? { cost: 0, clicks: 0, revenue: 0, cpa: 0, orders: 0, pno: 0 };
  const gg = sourceData.find(s => s.source === 'Google Ads')   ?? { cost: 0, clicks: 0, revenue: 0, cpa: 0, orders: 0, pno: 0 };
  const sz = sourceData.find(s => s.source === 'Seznam Ads') ?? { cost: 0, clicks: 0, revenue: 0, cpa: 0, orders: 0, pno: 0 };
  const hk = sourceData.find(s => s.source === 'Heureka')    ?? { cost: 0, clicks: 0, revenue: 0, cpa: 0, orders: 0, pno: 0 };
  const fbCpc  = fb.clicks > 0 ? fb.cost / fb.clicks : 0;
  const gCpc   = gg.clicks > 0 ? gg.cost / gg.clicks : 0;
  const szCpc  = sz.clicks > 0 ? sz.cost / sz.clicks : 0;
  const hkCpc  = hk.clicks > 0 ? hk.cost / hk.clicks : 0;
  const prevSourceData = hasPrevData ? getMarketingSourceData(
    prevStart.toISOString().split('T')[0],
    prevEnd.toISOString().split('T')[0],
    filters.countries,
    eurToCzk
  ) : [];
  const fbPrev = prevSourceData.find(s => s.source === 'Facebook Ads') ?? { cost: 0, clicks: 0 };
  const ggPrev = prevSourceData.find(s => s.source === 'Google Ads')   ?? { cost: 0, clicks: 0 };
  const szPrev = prevSourceData.find(s => s.source === 'Seznam Ads') ?? { cost: 0, clicks: 0 };
  const hkPrev = prevSourceData.find(s => s.source === 'Heureka')    ?? { cost: 0, clicks: 0 };
  const fbCpcPrev = fbPrev.clicks > 0 ? fbPrev.cost / fbPrev.clicks : 0;
  const gCpcPrev  = ggPrev.clicks > 0 ? ggPrev.cost / ggPrev.clicks : 0;
  const szCpcPrev = szPrev.clicks > 0 ? szPrev.cost / szPrev.clicks : 0;
  const hkCpcPrev = hkPrev.clicks > 0 ? hkPrev.cost / hkPrev.clicks : 0;
  const hasSeznam  = sz.cost > 0 || sz.clicks > 0;
  const hasHeureka = hk.cost > 0 || hk.clicks > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Marketingové investice</h1>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <KpiCard key={card.title} {...card} />
        ))}
      </div>

      {/* Chart */}
      <CostPnoChart data={chartData} currency={currency} hasPrevData={hasPrevData} />

      {/* Per-channel performance */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Výkon per channel</h2>
        </div>

        {/* FB + Google + Seznam + Heureka summary cards */}
        <div className={`grid grid-cols-1 gap-4 ${hasSeznam && hasHeureka ? 'sm:grid-cols-4' : hasSeznam || hasHeureka ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {/* Facebook Ads */}
          <div className="bg-white rounded-2xl border-2 border-blue-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Facebook Ads</span>
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                <Share2 size={15} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Náklady</p>
                <p className="text-xl font-bold text-slate-900">{fc(fb.cost)}</p>
                <YoyBadge pct={yoyPct(fb.cost, fbPrev.cost)} invert />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Kliky</p>
                <p className="text-xl font-bold text-slate-900">{formatNumber(fb.clicks)}</p>
                <YoyBadge pct={yoyPct(fb.clicks, fbPrev.clicks)} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">CPC</p>
                <p className="text-xl font-bold text-slate-900">{fbCpc.toFixed(2)} {sym}</p>
                <YoyBadge pct={yoyPct(fbCpc, fbCpcPrev)} invert />
              </div>
            </div>
          </div>

          {/* Google Ads */}
          <div className="bg-white rounded-2xl border-2 border-blue-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-green-700">Google Ads</span>
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
                <Search size={15} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Náklady</p>
                <p className="text-xl font-bold text-slate-900">{fc(gg.cost)}</p>
                <YoyBadge pct={yoyPct(gg.cost, ggPrev.cost)} invert />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Kliky</p>
                <p className="text-xl font-bold text-slate-900">{formatNumber(gg.clicks)}</p>
                <YoyBadge pct={yoyPct(gg.clicks, ggPrev.clicks)} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">CPC</p>
                <p className="text-xl font-bold text-slate-900">{gCpc.toFixed(2)} {sym}</p>
                <YoyBadge pct={yoyPct(gCpc, gCpcPrev)} invert />
              </div>
            </div>
          </div>

          {/* Heureka — zobrazit pouze pokud jsou data */}
          {hasHeureka && (
            <div className="bg-white rounded-2xl border-2 border-blue-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-700">Heureka</span>
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600">
                  <Search size={15} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Náklady</p>
                  <p className="text-xl font-bold text-slate-900">{fc(hk.cost)}</p>
                  <YoyBadge pct={yoyPct(hk.cost, hkPrev.cost)} invert />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Kliky</p>
                  <p className="text-xl font-bold text-slate-900">{formatNumber(hk.clicks)}</p>
                  <YoyBadge pct={yoyPct(hk.clicks, hkPrev.clicks)} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">CPC</p>
                  <p className="text-xl font-bold text-slate-900">{hkCpc.toFixed(2)} {sym}</p>
                  <YoyBadge pct={yoyPct(hkCpc, hkCpcPrev)} invert />
                </div>
              </div>
            </div>
          )}

          {/* Seznam Ads — zobrazit pouze pokud jsou data */}
          {hasSeznam && (
            <div className="bg-white rounded-2xl border-2 border-blue-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Seznam Ads</span>
                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500">
                  <List size={15} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Náklady</p>
                  <p className="text-xl font-bold text-slate-900">{fc(sz.cost)}</p>
                  <YoyBadge pct={yoyPct(sz.cost, szPrev.cost)} invert />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Kliky</p>
                  <p className="text-xl font-bold text-slate-900">{formatNumber(sz.clicks)}</p>
                  <YoyBadge pct={yoyPct(sz.clicks, szPrev.clicks)} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">CPC</p>
                  <p className="text-xl font-bold text-slate-900">{szCpc.toFixed(2)} {sym}</p>
                  <YoyBadge pct={yoyPct(szCpc, szCpcPrev)} invert />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CPC trend — pure line chart with YoY */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">CPC v čase – meziroční srovnání</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={marketingChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `${v} ${sym}`} tick={{ fontSize: 11, fill: '#9ca3af' }} width={65} />
              <Tooltip formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(2)} ${sym}`, String(name)]} labelFormatter={formatShortDate} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="cpc_fb" name="CPC Facebook" stroke={C.facebook} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="cpc_g"  name="CPC Google"   stroke={C.google}   strokeWidth={2} dot={false} connectNulls />
              {hasSeznam  && <Line type="monotone" dataKey="cpc_sz" name="CPC Seznam"  stroke={C.seznam}  strokeWidth={2} dot={false} connectNulls />}
              {hasHeureka && <Line type="monotone" dataKey="cpc_hk" name="CPC Heureka" stroke={C.heureka} strokeWidth={2} dot={false} connectNulls />}
              {hasPrevData && <Line type="monotone" dataKey="cpc_fb_prev" name="CPC Facebook (předch. rok)" stroke={C.facebookDark} strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls />}
              {hasPrevData && <Line type="monotone" dataKey="cpc_g_prev"  name="CPC Google (předch. rok)"   stroke={C.googleDark}   strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Daily marketing table with channel breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Přehled po dnech</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-900 border-b border-blue-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Datum</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase tracking-wide">Náklady celkem</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase tracking-wide">Facebook Ads</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase tracking-wide">Google Ads</th>
                  {hasSeznam  && <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase tracking-wide">Seznam Ads</th>}
                  {hasHeureka && <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase tracking-wide">Heureka</th>}
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((r, idx) => (
                  <tr key={r.date} className={`border-b border-gray-50 hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-2.5 text-gray-700 font-medium whitespace-nowrap">
                      {formatDate(new Date(r.date + 'T12:00:00'))}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-800 font-semibold">{fc(r.cost)}</td>
                    <td className="px-4 py-2.5 text-right text-blue-700">{fc(r.cost_facebook)}</td>
                    <td className="px-4 py-2.5 text-right text-green-700">{fc(r.cost_google)}</td>
                    {hasSeznam  && <td className="px-4 py-2.5 text-right text-orange-600">{fc(r.cost_seznam)}</td>}
                    {hasHeureka && <td className="px-4 py-2.5 text-right text-violet-600">{fc(r.cost_heureka)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Source breakdown table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Přehled podle zdroje</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-900 border-b border-blue-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Zdroj</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase tracking-wide">Náklady</th>
                </tr>
              </thead>
              <tbody>
                {sourceData.map((r, idx) => (
                  <tr key={r.source} className={`border-b border-gray-50 hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-2.5 text-gray-800 font-semibold">{r.source}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{formatCurrency(r.cost, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                  <td className="px-4 py-3 text-blue-600 text-xs">Celkem</td>
                  <td className="px-4 py-3 text-right">{fc(sourceData.reduce((s, r) => s + r.cost, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
