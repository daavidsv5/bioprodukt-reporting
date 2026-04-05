'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFilters, getDateRange } from '@/hooks/useFilters';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { C } from '@/lib/chartColors';
import React from 'react';
import {
  CreditCard, Users, Eye, MousePointerClick, Percent,
  Globe, ShoppingCart, TrendingUp, BadgeDollarSign, Zap,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { formatDate, formatShortDate } from '@/lib/formatters';

// ── Types ────────────────────────────────────────────────────────────────────

interface MetaKpi {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  purchases: number;
  addToCart: number;
  revenue: number;
  roas: number;
  cpa: number;
}

interface MetaDaily {
  date: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
}

interface MetaAd {
  adId: string;
  adName: string;
  campaignName: string;
  adsetName: string;
  thumbnailUrl: string | null;
  status: string;
  spend: number;
  reach: number;
  clicks: number;
  ctr: number;
  addToCart: number;
  purchases: number;
  revenue: number;
  cpa: number;
  roas: number;
}

interface MetaData {
  kpi: MetaKpi;
  kpiPrev: MetaKpi;
  daily: MetaDaily[];
  ads: MetaAd[];
}

type SortKey = 'spend' | 'reach' | 'clicks' | 'ctr' | 'purchases' | 'revenue' | 'cpa' | 'roas' | 'addToCart';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number, decimals = 2): string {
  return val.toFixed(decimals).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}
function fmtCzk(val: number): string {
  return `${Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0Kč`;
}
function fmtInt(val: number): string {
  return Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}
function fmtPct(val: number): string { return `${fmt(val)}\u00a0%`; }
function fmtRoas(val: number): string { return `${fmt(val, 2)}x`; }

function yoy(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

function statusLabel(s: string): { label: string; cls: string } {
  if (s === 'ACTIVE')  return { label: 'Aktivní',     cls: 'bg-emerald-100 text-emerald-700' };
  if (s === 'PAUSED')  return { label: 'Pozastaveno', cls: 'bg-amber-100 text-amber-700' };
  if (s === 'ARCHIVED') return { label: 'Archivováno', cls: 'bg-slate-100 text-slate-500' };
  return { label: s, cls: 'bg-slate-100 text-slate-500' };
}

// ── Small Chart ───────────────────────────────────────────────────────────────

function SmallChart({
  data, dataKey, color, yFormatter,
}: {
  data: MetaDaily[];
  dataKey: keyof MetaDaily;
  color: string;
  yFormatter: (v: number) => string;
}) {
  if (data.length === 0) {
    return <div className="h-52 flex items-center justify-center text-slate-400 text-sm">Žádná data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={208}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => formatShortDate(v)}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => yFormatter(v)}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          formatter={(v: number) => [yFormatter(v), '']}
          labelFormatter={(l: string) => formatShortDate(l)}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Line
          type="monotone"
          dataKey={dataKey as string}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Sort button ───────────────────────────────────────────────────────────────

function SortBtn({
  label, field, active, dir, onClick,
}: {
  label: string;
  field: SortKey;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: (f: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onClick(field)}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
      {active
        ? dir === 'desc'
          ? <ArrowDown size={13} />
          : <ArrowUp size={13} />
        : <ArrowUpDown size={13} className="opacity-40" />}
    </button>
  );
}

// ── MetaKpiBox ────────────────────────────────────────────────────────────────

function MetaKpiBox({
  title, value, icon, bg, textColor, yoyVal, hasPrevData, invertColors,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
  textColor?: string;
  yoyVal?: number | null;
  hasPrevData?: boolean;
  invertColors?: boolean;
}) {
  const isPositive = invertColors ? (yoyVal ?? 0) < 0 : (yoyVal ?? 0) > 0;
  const showBadge = hasPrevData && yoyVal !== null && yoyVal !== undefined;

  return (
    <div className={`${bg} rounded-2xl p-4 flex flex-col gap-2 border border-slate-200`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        <div className="text-slate-400">{icon}</div>
      </div>
      <p className={`text-2xl md:text-3xl font-bold leading-none ${textColor ?? 'text-slate-800'}`}>{value}</p>
      <div className="text-[11px]">
        {showBadge ? (
          <span className={`inline-flex items-center gap-0.5 font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
            {isPositive ? '▲' : '▼'} {Math.abs(yoyVal!).toFixed(1)} %
          </span>
        ) : (
          <span className="text-slate-400">– YoY</span>
        )}
      </div>
    </div>
  );
}

// ── CPA / ROAS color helpers ──────────────────────────────────────────────────

function cpaColor(cpa: number): string {
  if (cpa < 200) return 'text-emerald-600 font-semibold';
  if (cpa < 400) return 'text-amber-500 font-semibold';
  return 'text-rose-500 font-semibold';
}

function roasColor(roas: number): string {
  if (roas >= 3) return 'text-emerald-600 font-semibold';
  if (roas >= 1) return 'text-amber-500 font-semibold';
  return 'text-rose-500 font-semibold';
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MetaAdsPage() {
  const { filters } = useFilters();
  const { start, end } = getDateRange(filters);

  const [data, setData] = useState<MetaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const country =
    filters.countries.length === 1 ? filters.countries[0] : 'all';

  const fromStr = start.toISOString().split('T')[0];
  const toStr   = end.toISOString().split('T')[0];

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/meta?from=${fromStr}&to=${toStr}&country=${country}`)
      .then(r => {
        if (!r.ok) return r.json().then(j => Promise.reject(j.error ?? 'Chyba API'));
        return r.json();
      })
      .then((d: MetaData) => { setData(d); setLoading(false); })
      .catch((e: unknown) => {
        const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : JSON.stringify(e);
        setError(msg);
        setLoading(false);
      });
  }, [fromStr, toStr, country]);

  const sortedAds = useMemo(() => {
    if (!data?.ads) return [];
    return [...data.ads].sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [data?.ads, sortKey, sortDir]);

  function handleSort(field: SortKey) {
    if (field === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(field); setSortDir('desc'); }
  }

  const countryLabel = country === 'cz' ? 'CZ' : country === 'sk' ? 'SK' : null;
  const hasPrev = !!data && (data.kpiPrev.spend > 0 || data.kpiPrev.clicks > 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Načítám data z Meta…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-rose-600 font-medium mb-1">Chyba při načítání dat</p>
          <p className="text-slate-500 text-sm">{error ?? 'Neznámá chyba'}</p>
        </div>
      </div>
    );
  }

  const { kpi, kpiPrev, daily } = data;

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-5 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-800">Meta Ads</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {formatDate(start)} – {formatDate(end)}
            {countryLabel && <span className="ml-1">· {countryLabel}</span>}
          </p>
        </div>

        {/* KPI cards — row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetaKpiBox title="Útrata"  value={fmtCzk(kpi.spend)}      icon={<CreditCard size={16} />}        bg="bg-rose-50"   textColor="text-rose-600" yoyVal={yoy(kpi.spend, kpiPrev.spend)}       hasPrevData={hasPrev} invertColors />
          <MetaKpiBox title="Dosah"   value={fmtInt(kpi.reach)}       icon={<Users size={16} />}             bg="bg-blue-50"                              yoyVal={yoy(kpi.reach, kpiPrev.reach)}       hasPrevData={hasPrev} />
          <MetaKpiBox title="Imprese" value={fmtInt(kpi.impressions)} icon={<Eye size={16} />}               bg="bg-blue-50"                              yoyVal={yoy(kpi.impressions, kpiPrev.impressions)} hasPrevData={hasPrev} />
          <MetaKpiBox title="Kliky"   value={fmtInt(kpi.clicks)}      icon={<MousePointerClick size={16} />} bg="bg-blue-50"                              yoyVal={yoy(kpi.clicks, kpiPrev.clicks)}     hasPrevData={hasPrev} />
          <MetaKpiBox title="CTR"     value={fmtPct(kpi.ctr)}         icon={<Percent size={16} />}           bg="bg-blue-50"                              yoyVal={yoy(kpi.ctr, kpiPrev.ctr)}           hasPrevData={hasPrev} />
        </div>

        {/* KPI cards — row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetaKpiBox title="CPC"            value={fmtCzk(kpi.cpc)}                             icon={<Globe size={16} />}           bg="bg-slate-100"  yoyVal={yoy(kpi.cpc, kpiPrev.cpc)}                                               hasPrevData={hasPrev} invertColors />
          <MetaKpiBox title="Nákupy"         value={fmtInt(kpi.purchases)}                        icon={<ShoppingCart size={16} />}    bg="bg-emerald-50" yoyVal={yoy(kpi.purchases, kpiPrev.purchases)}                                    hasPrevData={hasPrev} />
          <MetaKpiBox title="Tržby z reklam" value={fmtCzk(kpi.revenue)}                         icon={<TrendingUp size={16} />}      bg="bg-emerald-50" textColor="text-emerald-700" yoyVal={yoy(kpi.revenue, kpiPrev.revenue)}          hasPrevData={hasPrev} />
          <MetaKpiBox title="CPA"            value={kpi.purchases > 0 ? fmtCzk(kpi.cpa) : '–'}  icon={<BadgeDollarSign size={16} />} bg="bg-amber-50"   yoyVal={kpi.purchases > 0 && kpiPrev.purchases > 0 ? yoy(kpi.cpa, kpiPrev.cpa) : null} hasPrevData={hasPrev} invertColors />
          <MetaKpiBox title="ROAS"           value={kpi.roas > 0 ? fmtRoas(kpi.roas) : '–'}     icon={<Zap size={16} />}             bg="bg-emerald-50" textColor="text-emerald-700" yoyVal={kpi.roas > 0 && kpiPrev.roas > 0 ? yoy(kpi.roas, kpiPrev.roas) : null} hasPrevData={hasPrev} />
        </div>

        {/* Charts 2×2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">CPC – Cena za klik</h3>
            <SmallChart data={daily} dataKey="cpc" color={C.secondary} yFormatter={(v) => fmtCzk((v))} />
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">CPA – Cena za nákup</h3>
            <SmallChart data={daily} dataKey="cpa" color={C.cost} yFormatter={(v) => fmtCzk((v))} />
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Nákupy</h3>
            <SmallChart data={daily} dataKey="purchases" color={C.margin} yFormatter={(v) => fmtInt(v)} />
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">ROAS</h3>
            <SmallChart data={daily} dataKey="roas" color={C.grossProfit} yFormatter={fmtRoas} />
          </div>
        </div>

        {/* Ad table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Sort bar */}
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-400 font-medium mr-1">Řadit dle:</span>
            {(
              [
                { label: 'Útrata',  field: 'spend'     },
                { label: 'Dosah',   field: 'reach'     },
                { label: 'Kliky',   field: 'clicks'    },
                { label: 'CTR',     field: 'ctr'       },
                { label: 'Nákupy',  field: 'purchases' },
                { label: 'CPA',     field: 'cpa'       },
                { label: 'ROAS',    field: 'roas'      },
                { label: 'Košík',   field: 'addToCart' },
              ] as { label: string; field: SortKey }[]
            ).map(({ label, field }) => (
              <SortBtn
                key={field}
                label={label}
                field={field}
                active={sortKey === field}
                dir={sortDir}
                onClick={handleSort}
              />
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-900">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">Kreativa</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">Kampaň</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">Sada reklam</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">Útrata</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">Dosah</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">Kliky</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">CTR</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">Košík</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">Nákupy</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">CPA</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-blue-100 uppercase tracking-wide">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedAds.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center py-10 text-slate-400 text-sm">
                      Žádná data pro vybrané období
                    </td>
                  </tr>
                )}
                {sortedAds.map((ad) => {
                  const st = statusLabel(ad.status);
                  const hasPurchase = ad.purchases > 0;
                  return (
                    <tr key={ad.adId} className="hover:bg-slate-50 transition-colors">
                      {/* Kreativa */}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3 min-w-[220px] max-w-[280px]">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                            {ad.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={ad.thumbnailUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <Eye size={16} className="text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-slate-800 font-medium text-xs leading-tight line-clamp-2">{ad.adName}</p>
                            <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.cls}`}>
                              {st.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      {/* Kampaň */}
                      <td className="px-3 py-3 max-w-[160px]">
                        <p className="text-slate-600 text-xs line-clamp-2 leading-tight">{ad.campaignName}</p>
                      </td>
                      {/* Sada reklam */}
                      <td className="px-3 py-3 max-w-[140px]">
                        <p className="text-slate-500 text-xs line-clamp-2 leading-tight">{ad.adsetName}</p>
                      </td>
                      {/* Útrata */}
                      <td className="px-3 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {fmtCzk(ad.spend)}
                      </td>
                      {/* Dosah */}
                      <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">
                        {fmtInt(ad.reach)}
                      </td>
                      {/* Kliky */}
                      <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">
                        {fmtInt(ad.clicks)}
                      </td>
                      {/* CTR */}
                      <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">
                        {fmtPct(ad.ctr)}
                      </td>
                      {/* Košík */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {ad.addToCart > 0
                          ? <span className="text-slate-700 font-medium">{fmtInt(ad.addToCart)}</span>
                          : <span className="text-slate-300">0</span>}
                      </td>
                      {/* Nákupy */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {hasPurchase
                          ? <span className="text-slate-700 font-medium">{fmtInt(ad.purchases)}</span>
                          : <span className="text-slate-300">0</span>}
                      </td>
                      {/* CPA */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {hasPurchase
                          ? <span className={cpaColor(ad.cpa)}>{fmtCzk(ad.cpa)}</span>
                          : <span className="text-slate-300">–</span>}
                      </td>
                      {/* ROAS */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {hasPurchase && ad.roas > 0
                          ? <span className={roasColor(ad.roas)}>{fmtRoas(ad.roas)}</span>
                          : <span className="text-slate-300">–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
