'use client';

import { useState, useMemo } from 'react';
import { Users, DollarSign, ShoppingCart, RefreshCw, Calendar, TrendingUp } from 'lucide-react';
import { retentionDataCZ } from '@/data/retentionDataCZ';
import { retentionDataSK } from '@/data/retentionDataSK';
import {
  computeRetentionKpis,
  computeYearCustomerMetrics,
  computeYearRetentionMetrics,
  computeYearRevenueMetrics,
  computeMonthlyChartData,
  computePurchaseDistribution,
  computeDaysBetweenHistogram,
  computeRfmSegments,
  computeMonthlyNewVsReturning,
  computeMonthlyNewVsReturningRevenue,
  computeCurrentMonthYoyCutoff,
  computeMonthlyRfmDistribution,
  computeMonthlyRfmRevenueDistribution,
  RFM_META,
  RFM_ORDER,
} from '@/lib/retentionUtils';
import { formatCurrency, formatPercent, formatNumber, formatShortDate, formatMonthYear } from '@/lib/formatters';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { C } from '@/lib/chartColors';
import StatCard from '@/components/kpi/StatCard';

type Tab = 'cz' | 'sk';

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-5">{title}</h2>
      {children}
    </div>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

const thClass = 'px-4 py-3 text-[11px] font-semibold text-white uppercase tracking-wider whitespace-nowrap';
const tdClass = 'px-4 py-2.5 whitespace-nowrap';

function fmtYAxis(v: number, currency: 'CZK' | 'EUR') {
  const s = currency === 'EUR' ? '€' : 'Kč';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ${s}`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k ${s}`;
  return `${Math.round(v)} ${s}`;
}

/** Tooltip pro měsíční vývoj RFM segmentů — hodnota (počty nebo tržby) + podíl v daném měsíci */
function RfmDistributionTooltip({
  active, label, fullData, segmentDefs, formatValue = formatNumber,
}: {
  active?: boolean;
  label?: any;
  fullData: { date: string; [key: string]: any }[];
  segmentDefs: { key: string; label: string; color: string }[];
  formatValue?: (v: number) => string;
}) {
  if (!active || !label) return null;
  const cur = fullData.find(d => d.date === label);
  if (!cur) return null;
  const total = segmentDefs.reduce((s, seg) => s + (cur[seg.key] ?? 0), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3.5 py-3 text-xs min-w-[220px]">
      <p className="font-semibold text-slate-700 mb-2">{formatMonthYear(label as string)}</p>
      {segmentDefs.map(seg => {
        const value = cur[seg.key] ?? 0;
        if (value === 0) return null;
        const pct = total > 0 ? (value / total) * 100 : 0;
        return (
          <div key={seg.key} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: seg.color }}>
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: seg.color }} />
              {seg.label}
            </span>
            <span className="font-semibold text-slate-700">
              {formatValue(value)} <span className="text-slate-400 font-normal">({pct.toFixed(1)} %)</span>
            </span>
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-4 mt-2 pt-2 border-t border-slate-100 font-semibold text-slate-700">
        <span>Celkem</span>
        <span>{formatValue(total)}</span>
      </div>
    </div>
  );
}

export default function RetentionPage() {
  const [tab, setTab] = useState<Tab>('cz');

  const data = tab === 'cz' ? retentionDataCZ : retentionDataSK;
  const currency = tab === 'cz' ? 'CZK' : 'EUR';
  const fc = (v: number) => formatCurrency(v, currency);
  const fp = (v: number) => formatPercent(v, 1);

  const rfmSegments       = useMemo(() => computeRfmSegments(data), [data]);
  const monthlyRfm        = useMemo(() => computeMonthlyRfmDistribution(data), [data]);
  const monthlyRfmRevenue = useMemo(() => computeMonthlyRfmRevenueDistribution(data), [data]);
  const rfmSegmentDefs    = useMemo(() => RFM_ORDER.map(seg => ({ key: seg, label: RFM_META[seg].label, color: RFM_META[seg].hex })), []);
  const kpis         = useMemo(() => computeRetentionKpis(data), [data]);
  const yearCustomer = useMemo(() => computeYearCustomerMetrics(data), [data]);
  const yearRetention= useMemo(() => computeYearRetentionMetrics(data), [data]);
  const yearRevenue  = useMemo(() => computeYearRevenueMetrics(data), [data]);
  const monthly      = useMemo(() => computeMonthlyChartData(data), [data]);
  const purchaseDist = useMemo(() => computePurchaseDistribution(data), [data]);
  const daysBins     = useMemo(() => computeDaysBetweenHistogram(data), [data]);
  const monthlyNewVsReturning = useMemo(() => computeMonthlyNewVsReturning(data), [data]);
  const monthlyNewVsReturningRevenue = useMemo(() => computeMonthlyNewVsReturningRevenue(data), [data]);
  const yoyCutoff = useMemo(() => computeCurrentMonthYoyCutoff(data), [data]);

  const totalOrders      = yearCustomer.reduce((s, r) => s + r.orders, 0);
  const totalNewCustomers= yearCustomer.reduce((s, r) => s + r.newCustomers, 0);
  const totalReturning   = yearCustomer.reduce((s, r) => s + r.returningCustomers, 0);
  const totalRevAll      = yearRevenue.reduce((s, r) => s + r.totalRevenue, 0);

  // Ø 1. nákup celkem — vážený průměr (váha = počet nových zákazníků)
  const totalAvgFirst = (() => {
    const weightedSum = yearCustomer.reduce((s, r) => s + r.avgFirstPurchase * r.newCustomers, 0);
    const totalWeight = yearCustomer.reduce((s, r) => s + (r.avgFirstPurchase > 0 ? r.newCustomers : 0), 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  })();

  // Ø Opakovaný nákup celkem — vážený průměr (váha = počet stávajících zákazníků)
  const totalAvgRepeat = (() => {
    const weightedSum = yearCustomer.reduce((s, r) => s + r.avgRepeatPurchase * r.returningCustomers, 0);
    const totalWeight = yearCustomer.reduce((s, r) => s + (r.avgRepeatPurchase > 0 ? r.returningCustomers : 0), 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  })();

  // Retenční sazby celkem — zpětný výpočet absolutních počtů
  const totalRate2Plus = (() => {
    const count = yearRetention.reduce((s, r) => s + (r.rate2Plus / 100) * r.customers, 0);
    return kpis.totalCustomers > 0 ? (count / kpis.totalCustomers) * 100 : 0;
  })();
  const totalRate3Plus = (() => {
    const count = yearRetention.reduce((s, r) => s + (r.rate3Plus / 100) * r.customers, 0);
    return kpis.totalCustomers > 0 ? (count / kpis.totalCustomers) * 100 : 0;
  })();

  // Obratové podíly celkem — zpětný výpočet absolutních obratů
  const totalRevShare1Plus = totalRevAll > 0
    ? (yearRevenue.reduce((s, r) => s + (r.revShare1Plus / 100) * r.totalRevenue, 0) / totalRevAll) * 100 : 0;
  const totalRevShare2Plus = totalRevAll > 0
    ? (yearRevenue.reduce((s, r) => s + (r.revShare2Plus / 100) * r.totalRevenue, 0) / totalRevAll) * 100 : 0;
  const totalRevShare3Plus = totalRevAll > 0
    ? (yearRevenue.reduce((s, r) => s + (r.revShare3Plus / 100) * r.totalRevenue, 0) / totalRevAll) * 100 : 0;

  // Yearly revenue for area chart
  const yearRevenueChart = yearRevenue.map(r => ({ year: r.year.toString(), obrat: Math.round(r.totalRevenue) }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Retenční analýza zákazníků</h1>
          <p className="text-sm text-slate-500 mt-0.5">Analýza nákupního chování zákazníků</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          {(['cz', 'sk'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                tab === t
                  ? t === 'cz'
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-slate-700'
              }`}
            >
              <span>{t === 'cz' ? '🇨🇿' : '🇸🇰'}</span> {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-slate-500">
        <span className="font-semibold text-slate-700">{formatNumber(totalOrders)}</span> objednávek
        {' '}•{' '}
        <span className="font-semibold text-slate-700">{formatNumber(kpis.totalCustomers)}</span> zákazníků
      </p>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Celkem zákazníků"   value={formatNumber(kpis.totalCustomers)}            icon={<Users size={18} />} />
        <StatCard title="Celkový obrat"       value={fc(kpis.totalRevenue)}                         icon={<DollarSign size={18} />} />
        <StatCard title="Ø objednávka"        value={fc(kpis.avgOrderValue)}                        icon={<ShoppingCart size={18} />} />
        <StatCard title="Opakovaný nákup"     value={fp(kpis.repeatPurchaseRate)}                   icon={<RefreshCw size={18} />} />
        <StatCard title="Ø dní mezi nákupy"   value={`${Math.round(kpis.avgDaysBetween)} dní`}      icon={<Calendar size={18} />} />
        <StatCard title="LTV / zákazník"      value={fc(kpis.ltvPerCustomer)}                       icon={<TrendingUp size={18} />} />
      </div>

      {/* Noví vs. stávající zákazníci — vývoj po měsících */}
      <ChartCard title="Noví vs. stávající zákazníci — vývoj po měsících">
        {(() => {
          const byDate = Object.fromEntries(monthlyNewVsReturning.map(d => [d.date, d]));
          return (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyNewVsReturning} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatMonthYear} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => formatNumber(v as number)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload ?? {};
                    const novi = d['noví'] ?? 0;
                    const stavajici = d['stávající'] ?? 0;
                    const total = novi + stavajici;
                    const isCurrentMonth = yoyCutoff !== null && (label as string).startsWith(yoyCutoff.monthKey);
                    // Aktuální (nedokončený) měsíc: srovnání s loňským rokem jen do stejného dne, ne za celý loňský měsíc
                    const prevDate = (label as string).replace(/^(\d{4})/, y => String(Number(y) - 1));
                    const prevFull = byDate[prevDate];
                    const prevLabel = isCurrentMonth
                      ? `vs. loňský rok (do ${yoyCutoff!.cutoffDay}. dne)`
                      : `vs. loňský rok (${formatMonthYear(prevDate)})`;
                    const prevNovi = isCurrentMonth ? yoyCutoff!.prevNoví : (prevFull?.['noví'] ?? null);
                    const prevStavajici = isCurrentMonth ? yoyCutoff!.prevStávající : (prevFull?.['stávající'] ?? null);
                    const yoy = (cur: number, p: number) => p > 0 ? ((cur - p) / p * 100) : null;
                    const entries = [
                      { name: 'Noví zákazníci',      key: 'noví',      color: C.newCustomers, val: novi,      prevVal: prevNovi },
                      { name: 'Stávající zákazníci', key: 'stávající', color: C.primary,      val: stavajici, prevVal: prevStavajici },
                    ];
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs shadow-sm min-w-[220px]">
                        <p className="font-semibold text-slate-600 mb-1.5">{formatMonthYear(label as string)}</p>
                        {entries.map(({ name, key, color, val, prevVal }) => {
                          const pct = total > 0 ? (val / total) * 100 : 0;
                          const diff = prevVal !== null ? yoy(val, prevVal) : null;
                          return (
                            <div key={key} className="mb-1">
                              <div className="flex items-center justify-between gap-4">
                                <span style={{ color }} className="font-medium">{name}</span>
                                <span className="text-slate-700 font-semibold tabular-nums">
                                  {formatNumber(val)}
                                  <span className="text-slate-400 font-normal ml-1">({pct.toFixed(1)} %)</span>
                                </span>
                              </div>
                              {diff !== null && (
                                <div className="flex items-center justify-between gap-4 mt-0.5">
                                  <span className="text-slate-400 pl-0.5">{prevLabel}</span>
                                  <span className={`font-semibold tabular-nums ${diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)} %
                                    <span className="text-slate-400 font-normal ml-1">({formatNumber(prevVal!)})</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {total > 0 && (
                          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1 mt-1">
                            <span className="text-slate-400">Celkem</span>
                            <span className="text-slate-600 font-semibold tabular-nums">
                              {formatNumber(total)}
                              {prevNovi !== null && prevStavajici !== null && (() => {
                                const prevTotal = prevNovi + prevStavajici;
                                const diff = yoy(total, prevTotal);
                                return diff !== null ? (
                                  <span className={`ml-2 font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)} %
                                  </span>
                                ) : null;
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} iconType="square" iconSize={9} />
                <Bar dataKey="noví"      name="Noví zákazníci"      fill={C.newCustomers} radius={[3, 3, 0, 0]} />
                <Bar dataKey="stávající" name="Stávající zákazníci" fill={C.primary}      radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          );
        })()}
      </ChartCard>

      {/* Noví vs. stávající zákazníci — tržby bez DPH po měsících */}
      <ChartCard title="Noví vs. stávající zákazníci — tržby bez DPH po měsících">
        {(() => {
          const byDate = Object.fromEntries(monthlyNewVsReturningRevenue.map(d => [d.date, d]));
          return (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyNewVsReturningRevenue} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatMonthYear} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => fmtYAxis(v as number, currency)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload ?? {};
                    const novi = d['noví'] ?? 0;
                    const stavajici = d['stávající'] ?? 0;
                    const total = novi + stavajici;
                    const isCurrentMonth = yoyCutoff !== null && (label as string).startsWith(yoyCutoff.monthKey);
                    const prevDate = (label as string).replace(/^(\d{4})/, y => String(Number(y) - 1));
                    const prevFull = byDate[prevDate];
                    const prevLabel = isCurrentMonth
                      ? `vs. loňský rok (do ${yoyCutoff!.cutoffDay}. dne)`
                      : `vs. loňský rok (${formatMonthYear(prevDate)})`;
                    const prevNovi = isCurrentMonth ? yoyCutoff!.prevNovíRevenue : (prevFull?.['noví'] ?? null);
                    const prevStavajici = isCurrentMonth ? yoyCutoff!.prevStávajícíRevenue : (prevFull?.['stávající'] ?? null);
                    const yoy = (cur: number, p: number) => p > 0 ? ((cur - p) / p * 100) : null;
                    const entries = [
                      { name: 'Noví zákazníci',      key: 'noví',      color: C.newCustomers, val: novi,      prevVal: prevNovi },
                      { name: 'Stávající zákazníci', key: 'stávající', color: C.primary,      val: stavajici, prevVal: prevStavajici },
                    ];
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs shadow-sm min-w-[220px]">
                        <p className="font-semibold text-slate-600 mb-1.5">{formatMonthYear(label as string)}</p>
                        {entries.map(({ name, key, color, val, prevVal }) => {
                          const pct = total > 0 ? (val / total) * 100 : 0;
                          const diff = prevVal !== null ? yoy(val, prevVal) : null;
                          return (
                            <div key={key} className="mb-1">
                              <div className="flex items-center justify-between gap-4">
                                <span style={{ color }} className="font-medium">{name}</span>
                                <span className="text-slate-700 font-semibold tabular-nums">
                                  {fc(val)}
                                  <span className="text-slate-400 font-normal ml-1">({pct.toFixed(1)} %)</span>
                                </span>
                              </div>
                              {diff !== null && (
                                <div className="flex items-center justify-between gap-4 mt-0.5">
                                  <span className="text-slate-400 pl-0.5">{prevLabel}</span>
                                  <span className={`font-semibold tabular-nums ${diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)} %
                                    <span className="text-slate-400 font-normal ml-1">({fc(prevVal!)})</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {total > 0 && (
                          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1 mt-1">
                            <span className="text-slate-400">Celkem</span>
                            <span className="text-slate-600 font-semibold tabular-nums">
                              {fc(total)}
                              {prevNovi !== null && prevStavajici !== null && (() => {
                                const prevTotal = prevNovi + prevStavajici;
                                const diff = yoy(total, prevTotal);
                                return diff !== null ? (
                                  <span className={`ml-2 font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)} %
                                  </span>
                                ) : null;
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} iconType="square" iconSize={9} />
                <Bar dataKey="noví"      name="Noví zákazníci"      fill={C.newCustomers} radius={[3, 3, 0, 0]} />
                <Bar dataKey="stávající" name="Stávající zákazníci" fill={C.primary}      radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          );
        })()}
      </ChartCard>

      {/* RFM Segmentace */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">RFM Segmentace zákazníků</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            R = Recency (dní od posledního nákupu) · F = Frequency (počet nákupů) · M = Monetary (celkový obrat bez DPH)
          </p>
        </div>

        {/* Segment cards 2×3 grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rfmSegments.map(seg => (
            <div key={seg.segment} className={`rounded-xl border-2 ${seg.borderColor} ${seg.color} p-3 space-y-2`}>
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-wider ${seg.textColor}`}>{seg.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{seg.description}</p>
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <p className={`text-2xl font-bold ${seg.textColor}`}>{formatNumber(seg.count)}</p>
                  <p className="text-[10px] text-slate-400">{seg.customersPct.toFixed(1)} % zákazníků</p>
                </div>
                <div className="pb-0.5">
                  <p className="text-sm font-semibold text-slate-700">{seg.revenuePct.toFixed(1)} %</p>
                  <p className="text-[10px] text-slate-400">obratu</p>
                </div>
              </div>
              <div className="flex gap-3 text-[10px] text-slate-500">
                <span>Ø R: <strong className="text-slate-700">{seg.avgRecency} dní</strong></span>
                <span>Ø F: <strong className="text-slate-700">{seg.avgFrequency}×</strong></span>
                <span>Ø M: <strong className="text-slate-700">{fc(seg.avgMonetary)}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* Distribution bar */}
        <div>
          <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">Distribuce zákazníků</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {rfmSegments.filter(s => s.count > 0).map(seg => (
              <div
                key={seg.segment}
                className={`${seg.barColor} transition-all`}
                style={{ width: `${seg.customersPct}%` }}
                title={`${seg.label}: ${formatNumber(seg.count)} (${seg.customersPct.toFixed(1)} %)`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {rfmSegments.filter(s => s.count > 0).map(seg => (
              <span key={seg.segment} className="flex items-center gap-1 text-[10px] text-slate-500">
                <span className={`inline-block w-2 h-2 rounded-sm ${seg.barColor}`} />
                {seg.label} ({seg.customersPct.toFixed(0)} %)
              </span>
            ))}
          </div>
        </div>

        {/* Rozložení segmentů v čase (měsíčně) */}
        <div>
          <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">Rozložení segmentů v čase (měsíčně)</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyRfm} margin={{ top: 4, right: 16, left: 4, bottom: 4 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatMonthYear} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `${Math.round((v as number) * 100)} %`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<RfmDistributionTooltip fullData={monthlyRfm} segmentDefs={rfmSegmentDefs} />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} iconType="square" iconSize={9} />
              {rfmSegmentDefs.map(seg => (
                <Area key={seg.key} type="monotone" dataKey={seg.key} name={seg.label} stackId="a" stroke={seg.color} fill={seg.color} fillOpacity={0.85} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Rozložení tržeb dle segmentů v čase (měsíčně) */}
        <div>
          <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">Rozložení tržeb dle segmentů v čase (měsíčně)</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyRfmRevenue} margin={{ top: 4, right: 16, left: 4, bottom: 4 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatMonthYear} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `${Math.round((v as number) * 100)} %`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<RfmDistributionTooltip fullData={monthlyRfmRevenue} segmentDefs={rfmSegmentDefs} formatValue={fc} />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} iconType="square" iconSize={9} />
              {rfmSegmentDefs.map(seg => (
                <Area key={seg.key} type="monotone" dataKey={seg.key} name={seg.label} stackId="a" stroke={seg.color} fill={seg.color} fillOpacity={0.85} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Action table */}
        <div>
          <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wider">Doporučené akce</p>
          <div className="space-y-2">
            {rfmSegments.filter(s => s.count > 0).map(seg => (
              <div key={seg.segment} className={`flex gap-3 items-start rounded-lg px-3 py-2.5 border ${seg.borderColor} ${seg.color}`}>
                <div className="flex-shrink-0 w-24">
                  <p className={`text-[11px] font-bold ${seg.textColor}`}>{seg.label}</p>
                  <p className="text-[10px] text-slate-400">{formatNumber(seg.count)} zákazníků</p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{seg.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts — řada 1: LTV + AOV */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Vývoj LTV v čase">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => fmtYAxis(v, currency)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v: any) => [fc(v as number), 'LTV / zákazník']} labelFormatter={(l: any) => formatShortDate(l as string)} />
              <Line type="monotone" dataKey="ltv" name="LTV" stroke={C.rate} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vývoj průměrné objednávky v čase">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => fmtYAxis(v, currency)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v: any) => [fc(v as number), 'Ø objednávka']} labelFormatter={(l: any) => formatShortDate(l as string)} />
              <Line type="monotone" dataKey="aov" name="Ø objednávka" stroke={C.aov} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts — řada 2: Obrat po letech + Zákazníci podle počtu nákupů */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Vývoj obratu po letech">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={yearRevenueChart} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="gradObrat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmtYAxis(v, currency)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip formatter={(v: any) => [fc(v as number), 'Obrat']} />
              <Area type="monotone" dataKey="obrat" name="Obrat" stroke={C.primary} fill="url(#gradObrat)" strokeWidth={2} dot={{ r: 5, fill: C.primary }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Zákazníci podle počtu nákupů">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={purchaseDist} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${v.toFixed(0)} %`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v: any) => [`${(v as number).toFixed(1)} %`, 'Podíl zákazníků']} />
              <Bar dataKey="customersPct" name="Zákazníci %" fill={C.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts — řada 3: Obrat podle nákupů + Prodleva */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Obrat podle počtu nákupů">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={purchaseDist} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${v.toFixed(0)} %`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v: any) => [`${(v as number).toFixed(1)} %`, 'Podíl obratu']} />
              <Bar dataKey="revenuePct" name="Obrat %" fill={C.rate} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Prodleva mezi nákupy">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={daysBins} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${v.toFixed(0)} %`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v: any) => [`${(v as number).toFixed(1)} %`, 'Podíl']} />
              <Bar dataKey="pct" name="Prodleva %" fill={C.aov} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts — řada 4: 1. vs opakovaný nákup + Noví vs stávající */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Průměrná objednávka: 1. nákup vs. opakovaný">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={yearCustomer} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmtYAxis(v, currency)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(v: any) => [fc(v as number)]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} iconType="square" iconSize={9} />
              <Bar dataKey="avgFirstPurchase"  name="1. nákup"          fill={C.primary} radius={[3, 3, 0, 0]} barSize={24} />
              <Bar dataKey="avgRepeatPurchase" name="Opakovaný nákup"   fill={C.rate}    radius={[3, 3, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Noví vs. stávající zákazníci (zákazník může být v obou kategoriích)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={yearCustomer} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="0" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} iconType="square" iconSize={9} />
              <Bar dataKey="newCustomers"       name="Noví zákazníci"      fill={C.newCustomers} radius={[3, 3, 0, 0]} barSize={24} />
              <Bar dataKey="returningCustomers" name="Stávající zákazníci" fill={C.primary}      radius={[3, 3, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Zákaznické metriky */}
      <TableCard title="Zákaznické metriky — Noví = 1. nákup vůbec; Stávající = měli v daném roce 2.+ nákup (zákazník může být v obou)">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-900 border-b border-blue-800">
              <th className={`${thClass} text-left`}>Rok</th>
              <th className={`${thClass} text-right`}>Zákazníků</th>
              <th className={`${thClass} text-right`}>Nových</th>
              <th className={`${thClass} text-right`}>Stávajících</th>
              <th className={`${thClass} text-right`}>Objednávek</th>
              <th className={`${thClass} text-right`}>Ø objednávka</th>
              <th className={`${thClass} text-right`}>Ø 1. nákup</th>
              <th className={`${thClass} text-right`}>Ø opakovaný</th>
              <th className={`${thClass} text-right`}>Ø dní mezi nákupy</th>
            </tr>
          </thead>
          <tbody>
            {yearCustomer.map((r, idx) => (
              <tr key={r.year} className={`border-b border-gray-50 hover:bg-slate-50/70 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                <td className={`${tdClass} font-semibold text-slate-600`}>{r.year}</td>
                <td className={`${tdClass} text-right text-slate-700`}>{formatNumber(r.customers)}</td>
                <td className={`${tdClass} text-right text-emerald-700 font-medium`}>{formatNumber(r.newCustomers)}</td>
                <td className={`${tdClass} text-right text-blue-700 font-medium`}>{formatNumber(r.returningCustomers)}</td>
                <td className={`${tdClass} text-right text-slate-600`}>{formatNumber(r.orders)}</td>
                <td className={`${tdClass} text-right text-slate-600`}>{fc(r.avgOrderValue)}</td>
                <td className={`${tdClass} text-right text-slate-600`}>{r.avgFirstPurchase > 0 ? fc(r.avgFirstPurchase) : '—'}</td>
                <td className={`${tdClass} text-right text-slate-600`}>{r.avgRepeatPurchase > 0 ? fc(r.avgRepeatPurchase) : '—'}</td>
                <td className={`${tdClass} text-right text-slate-600`}>{r.avgDaysBetween > 0 ? `${Math.round(r.avgDaysBetween)} dní` : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50/60 border-t-2 border-blue-100 font-semibold">
              <td className={`${tdClass} text-blue-600 text-xs`}>Celkem</td>
              <td className={`${tdClass} text-right text-slate-800`}>{formatNumber(kpis.totalCustomers)}</td>
              <td className={`${tdClass} text-right text-emerald-700`}>{formatNumber(totalNewCustomers)}</td>
              <td className={`${tdClass} text-right text-blue-700`}>{formatNumber(totalReturning)}</td>
              <td className={`${tdClass} text-right text-slate-800`}>{formatNumber(totalOrders)}</td>
              <td className={`${tdClass} text-right text-slate-800`}>{fc(kpis.avgOrderValue)}</td>
              <td className={`${tdClass} text-right text-slate-600`}>{totalAvgFirst > 0 ? fc(totalAvgFirst) : '—'}</td>
              <td className={`${tdClass} text-right text-slate-600`}>{totalAvgRepeat > 0 ? fc(totalAvgRepeat) : '—'}</td>
              <td className={`${tdClass} text-right text-slate-800`}>{kpis.avgDaysBetween > 0 ? `${Math.round(kpis.avgDaysBetween)} dní` : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </TableCard>

      {/* Retenční metriky */}
      <TableCard title="Retenční metriky (zákazníci)">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-900 border-b border-blue-800">
              <th className={`${thClass} text-left`}>Rok</th>
              <th className={`${thClass} text-right`}>Zákazníků</th>
              <th className={`${thClass} text-right`}>&gt; 1 nákup</th>
              <th className={`${thClass} text-right`}>&gt; 2 nákupy</th>
              <th className={`${thClass} text-right`}>&gt; 3 nákupy</th>
            </tr>
          </thead>
          <tbody>
            {yearRetention.map((r, idx) => (
              <tr key={r.year} className={`border-b border-gray-50 hover:bg-slate-50/70 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                <td className={`${tdClass} font-semibold text-slate-600`}>{r.year}</td>
                <td className={`${tdClass} text-right text-slate-700`}>{formatNumber(r.customers)}</td>
                <td className={`${tdClass} text-right`}><span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">{fp(r.rate1Plus)}</span></td>
                <td className={`${tdClass} text-right`}><span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-0.5 rounded-full">{fp(r.rate2Plus)}</span></td>
                <td className={`${tdClass} text-right`}><span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-0.5 rounded-full">{fp(r.rate3Plus)}</span></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50/60 border-t-2 border-blue-100 font-semibold">
              <td className={`${tdClass} text-blue-600 text-xs`}>Celkem</td>
              <td className={`${tdClass} text-right text-slate-800`}>{formatNumber(kpis.totalCustomers)}</td>
              <td className={`${tdClass} text-right`}><span className="inline-block bg-blue-200 text-blue-900 text-xs font-bold px-2 py-0.5 rounded-full">{fp(kpis.repeatPurchaseRate)}</span></td>
              <td className={`${tdClass} text-right`}><span className="inline-block bg-indigo-200 text-indigo-900 text-xs font-bold px-2 py-0.5 rounded-full">{fp(totalRate2Plus)}</span></td>
              <td className={`${tdClass} text-right`}><span className="inline-block bg-purple-200 text-purple-900 text-xs font-bold px-2 py-0.5 rounded-full">{fp(totalRate3Plus)}</span></td>
            </tr>
          </tfoot>
        </table>
      </TableCard>

      {/* Obratové metriky */}
      <TableCard title="Obratové metriky">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-900 border-b border-blue-800">
              <th className={`${thClass} text-left`}>Rok</th>
              <th className={`${thClass} text-right`}>Celkový obrat</th>
              <th className={`${thClass} text-right`}>Obrat &gt; 1 nákup</th>
              <th className={`${thClass} text-right`}>Obrat &gt; 2 nákupy</th>
              <th className={`${thClass} text-right`}>Obrat &gt; 3 nákupy</th>
            </tr>
          </thead>
          <tbody>
            {yearRevenue.map((r, idx) => (
              <tr key={r.year} className={`border-b border-gray-50 hover:bg-slate-50/70 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                <td className={`${tdClass} font-semibold text-slate-600`}>{r.year}</td>
                <td className={`${tdClass} text-right text-slate-800 font-medium`}>{fc(r.totalRevenue)}</td>
                <td className={`${tdClass} text-right`}><span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">{fp(r.revShare1Plus)}</span></td>
                <td className={`${tdClass} text-right`}><span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-0.5 rounded-full">{fp(r.revShare2Plus)}</span></td>
                <td className={`${tdClass} text-right`}><span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-0.5 rounded-full">{fp(r.revShare3Plus)}</span></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50/60 border-t-2 border-blue-100 font-semibold">
              <td className={`${tdClass} text-blue-600 text-xs`}>Celkem</td>
              <td className={`${tdClass} text-right text-slate-800`}>{fc(totalRevAll)}</td>
              <td className={`${tdClass} text-right`}><span className="inline-block bg-blue-200 text-blue-900 text-xs font-bold px-2 py-0.5 rounded-full">{fp(totalRevShare1Plus)}</span></td>
              <td className={`${tdClass} text-right`}><span className="inline-block bg-indigo-200 text-indigo-900 text-xs font-bold px-2 py-0.5 rounded-full">{fp(totalRevShare2Plus)}</span></td>
              <td className={`${tdClass} text-right`}><span className="inline-block bg-purple-200 text-purple-900 text-xs font-bold px-2 py-0.5 rounded-full">{fp(totalRevShare3Plus)}</span></td>
            </tr>
          </tfoot>
        </table>
      </TableCard>
    </div>
  );
}
