'use client';

import { useState, useMemo } from 'react';
import { realDataCZ } from '@/data/realDataCZ';
import { marginDataCZ } from '@/data/marginDataCZ';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/formatters';
import StatCard from '@/components/kpi/StatCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, LineChart, Line, Cell,
} from 'recharts';
import {
  Target, ShoppingCart, MousePointer, Wallet, Percent,
  ChevronDown, ChevronUp, TrendingUp, AlertCircle, RotateCcw,
  DollarSign, Activity,
} from 'lucide-react';
import { C } from '@/lib/chartColors';

// ── types ────────────────────────────────────────────────────────────────────

interface Inputs {
  targetProfit: number;
  aov: number;
  marginPct: number;
  cr: number;
  avgCpc: number;
  fulfillmentCost: number;
  fixedMonthlyCost: number;
  agencyFee: number;
  ltv: number;
  returnRate: number;
}

interface CalcResult {
  adBudget: number;
  requiredConversions: number;
  requiredClicks: number;
  requiredRevenue: number;
  cpa: number;
  pno: number;
  effectiveNetPerOrder: number;
  aovExVat: number;
  purchaseCostPerOrder: number;
}

// ── calculation ───────────────────────────────────────────────────────────────

function compute(i: Inputs): CalcResult | null {
  const { targetProfit, aov, marginPct, cr, avgCpc, fulfillmentCost, fixedMonthlyCost, agencyFee, ltv, returnRate } = i;
  if (aov <= 0 || marginPct <= 0 || cr <= 0 || avgCpc <= 0) return null;

  const aovExVat = aov / 1.21;
  const grossMarginPerOrder = aovExVat * (marginPct / 100);
  const effectiveNetPerOrder = (grossMarginPerOrder - fulfillmentCost) * (1 - returnRate / 100) * ltv;

  // adBudget = (targetProfit + fixedCosts) / (effectiveNetPerOrder × cr/100/avgCpc − 1)
  const denominator = (effectiveNetPerOrder * (cr / 100)) / avgCpc - 1;
  if (denominator <= 0) return null;

  const adBudget = (targetProfit + fixedMonthlyCost + agencyFee) / denominator;
  if (adBudget < 0) return null;

  const requiredClicks = adBudget / avgCpc;
  const requiredConversions = requiredClicks * (cr / 100);
  const requiredRevenue = requiredConversions * aovExVat;
  const cpa = adBudget / requiredConversions;
  const pno = (adBudget / requiredRevenue) * 100;
  const purchaseCostPerOrder = aovExVat * (1 - marginPct / 100);

  return { adBudget, requiredConversions, requiredClicks, requiredRevenue, cpa, pno, effectiveNetPerOrder, aovExVat, purchaseCostPerOrder };
}

// ── sub-components ────────────────────────────────────────────────────────────

function InputField({
  label, value, onChange, unit, help, min = 0, step = 1,
}: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; help?: string; min?: number; step?: number;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 leading-snug">
        {label}
        {help && <span className="ml-1 text-slate-400 normal-case font-normal">{help}</span>}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltipBase({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      {label !== undefined && (
        <p className="font-semibold text-slate-600 mb-2 pb-1.5 border-b border-slate-100">{label}</p>
      )}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: p.color }} />
            <span className="text-slate-500">{p.name}</span>
          </div>
          <span className="font-semibold text-slate-700">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ProfitPlannerPage() {

  // ── defaults from last 30 days of CZ data ─────────────────────────────────
  const defaultValues = useMemo<Omit<Inputs, 'targetProfit' | 'fulfillmentCost' | 'fixedMonthlyCost' | 'agencyFee' | 'ltv' | 'returnRate'>>(() => {
    const sorted = [...realDataCZ].sort((a, b) => b.date.localeCompare(a.date));
    const last30 = sorted.slice(0, 30);
    const totalOrders = last30.reduce((s, d) => s + d.orders, 0);
    const totalRevenueVat = last30.reduce((s, d) => s + d.revenue_vat, 0);
    const totalCost = last30.reduce((s, d) => s + d.cost, 0);
    const totalClicks = last30.reduce((s, d) =>
      s + d.clicks_facebook + d.clicks_google + d.clicks_seznam + d.clicks_heureka, 0);

    const aov = totalOrders > 0 ? Math.round(totalRevenueVat / totalOrders / 10) * 10 : 1200;
    const avgCpc = totalClicks > 0 ? Math.round((totalCost / totalClicks) * 10) / 10 : 8;

    const last30Dates = new Set(last30.map(d => d.date));
    const marginLast30 = marginDataCZ.filter(d => last30Dates.has(d.date));
    const totalMarginRev = marginLast30.reduce((s, d) => s + d.revenue, 0);
    const totalPurchaseCost = marginLast30.reduce((s, d) => s + d.purchaseCost, 0);
    const marginPct = totalMarginRev > 0
      ? Math.round((totalMarginRev - totalPurchaseCost) / totalMarginRev * 1000) / 10
      : 40;

    return { aov, avgCpc, marginPct, cr: 1.5 };
  }, []);

  const defaultInputs: Inputs = {
    targetProfit: 50000,
    aov: defaultValues.aov,
    marginPct: defaultValues.marginPct,
    cr: defaultValues.cr,
    avgCpc: defaultValues.avgCpc,
    fulfillmentCost: 50,
    fixedMonthlyCost: 30000,
    agencyFee: 0,
    ltv: 1,
    returnRate: 2,
  };

  const [inputs, setInputs] = useState<Inputs>(defaultInputs);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (key: keyof Inputs) => (v: number) => setInputs(prev => ({ ...prev, [key]: v }));

  // ── computation ─────────────────────────────────────────────────────────────
  const result = useMemo(() => compute(inputs), [inputs]);

  // PNO traffic light
  const pnoColor = result
    ? result.pno < inputs.marginPct * 0.5
      ? 'text-emerald-600'
      : result.pno < inputs.marginPct
        ? 'text-amber-600'
        : 'text-rose-600'
    : 'text-slate-400';

  const pnoLabel = result
    ? result.pno < inputs.marginPct * 0.5
      ? 'Výborné PNO'
      : result.pno < inputs.marginPct
        ? 'Přijatelné PNO'
        : 'PNO přesahuje marži'
    : '';

  // ── chart data ───────────────────────────────────────────────────────────────

  // Chart 1: rozpad objednávky
  const breakdownData = useMemo(() => {
    if (!result) return [];
    const { aovExVat, purchaseCostPerOrder, cpa, effectiveNetPerOrder } = result;
    const fixedPerOrder = result.requiredConversions > 0
      ? (inputs.fixedMonthlyCost + inputs.agencyFee) / result.requiredConversions
      : 0;
    const zisk = aovExVat - purchaseCostPerOrder - inputs.fulfillmentCost - cpa - fixedPerOrder;
    return [{
      name: '1 objednávka',
      'Nákupní cena': Math.round(purchaseCostPerOrder),
      'Fulfillment': Math.round(inputs.fulfillmentCost),
      'Reklama (CPA)': Math.round(cpa),
      'Fixní náklady': Math.round(fixedPerOrder),
      'Čistý zisk': Math.round(Math.max(0, zisk)),
    }];
    void effectiveNetPerOrder;
  }, [result, inputs]);

  // Chart 2: zisk vs. investice
  const profitVsBudgetData = useMemo(() => {
    if (!result) return [];
    const maxBudget = result.adBudget * 2.5;
    const steps = 20;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const budget = (maxBudget / steps) * i;
      const conversions = (budget * (inputs.cr / 100)) / inputs.avgCpc;
      const profit = conversions * result.effectiveNetPerOrder - budget - inputs.fixedMonthlyCost - inputs.agencyFee;
      return { budget: Math.round(budget), zisk: Math.round(profit) };
    });
  }, [result, inputs]);

  // Chart 3: scénáře co kdyby
  const scenariosData = useMemo(() => {
    if (!result) return [];
    const baseline = result.adBudget;
    const scenarios: { name: string; inputs: Inputs }[] = [
      { name: 'AOV −20 %',    inputs: { ...inputs, aov: inputs.aov * 0.8 } },
      { name: 'AOV +20 %',    inputs: { ...inputs, aov: inputs.aov * 1.2 } },
      { name: 'CR −20 %',     inputs: { ...inputs, cr: inputs.cr * 0.8 } },
      { name: 'CR +20 %',     inputs: { ...inputs, cr: inputs.cr * 1.2 } },
      { name: 'Marže −20 %',  inputs: { ...inputs, marginPct: inputs.marginPct * 0.8 } },
      { name: 'Marže +20 %',  inputs: { ...inputs, marginPct: inputs.marginPct * 1.2 } },
      { name: 'CPC −20 %',    inputs: { ...inputs, avgCpc: inputs.avgCpc * 0.8 } },
      { name: 'CPC +20 %',    inputs: { ...inputs, avgCpc: inputs.avgCpc * 1.2 } },
    ];
    return scenarios.map(s => {
      const r = compute(s.inputs);
      const budget = r?.adBudget ?? null;
      return {
        name: s.name,
        rozpočet: budget !== null ? Math.round(budget) : 0,
        baseline: Math.round(baseline),
        feasible: r !== null,
        better: budget !== null && budget < baseline,
      };
    });
  }, [result, inputs]);

  // Chart 4: citlivost na marži
  const marginSensitivityData = useMemo(() => {
    const from = Math.max(5, inputs.marginPct - 20);
    const to = inputs.marginPct + 20;
    const results = [];
    for (let m = from; m <= to; m += 2) {
      const r = compute({ ...inputs, marginPct: m });
      results.push({
        marže: m,
        'Rekl. rozpočet': r ? Math.round(r.adBudget) : null,
        'PNO %': r ? Math.round(r.pno * 10) / 10 : null,
      });
    }
    return results;
  }, [inputs]);

  const fmtKc = (v: number) => formatCurrency(v, 'CZK');

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-xl">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Plánovač zisku</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Zadejte cílový čistý zisk — kalkulačka zpětně vypočítá potřebný reklamní rozpočet a klíčové metriky.
        </p>
      </div>

      {/* Inputs + Results grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Inputs card */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-blue-800 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Vstupní parametry</h2>
            <button
              onClick={() => setInputs(defaultInputs)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors"
              title="Obnovit výchozí hodnoty"
            >
              <RotateCcw size={13} />
              Výchozí hodnoty
            </button>
          </div>

          {/* Basic inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <InputField
                label="Cílový čistý zisk"
                value={inputs.targetProfit}
                onChange={set('targetProfit')}
                unit="Kč / měsíc"
                step={1000}
              />
            </div>
            <InputField label="Průměrná hodnota objednávky (AOV)" value={inputs.aov} onChange={set('aov')} unit="Kč vč. DPH" help="(vč. DPH)" step={10} />
            <InputField label="Hrubá marže" value={inputs.marginPct} onChange={set('marginPct')} unit="%" step={0.5} min={1} />
            <InputField label="Konverzní poměr (CR)" value={inputs.cr} onChange={set('cr')} unit="%" step={0.1} min={0.1} />
            <InputField label="Průměrné CPC" value={inputs.avgCpc} onChange={set('avgCpc')} unit="Kč / klik" step={0.5} min={0.1} />
          </div>

          {/* Advanced toggle */}
          <div>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Pokročilé nastavení
            </button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
              <InputField label="Fixní náklady na konverzi" value={inputs.fulfillmentCost} onChange={set('fulfillmentCost')} unit="Kč" help="(balení, fulfillment)" />
              <InputField label="Fixní měsíční náklady" value={inputs.fixedMonthlyCost} onChange={set('fixedMonthlyCost')} unit="Kč / měsíc" step={1000} help="(mzdy, nájem…)" />
              <InputField label="Agenturní fee" value={inputs.agencyFee} onChange={set('agencyFee')} unit="Kč / měsíc" step={1000} />
              <InputField label="LTV multiplikátor" value={inputs.ltv} onChange={set('ltv')} unit="×" step={0.1} min={1} help="(opakované nákupy)" />
              <InputField label="Vratky a storna" value={inputs.returnRate} onChange={set('returnRate')} unit="%" step={0.5} />
            </div>
          )}

          {/* Pre-fill note */}
          <p className="text-[11px] text-slate-400">
            AOV, marže a CPC předvyplněny z posledních 30 dní dat CZ.
          </p>
        </div>

        {/* Results card */}
        <div className="space-y-4">
          {!result ? (
            <div className="bg-white rounded-2xl shadow-sm border-2 border-rose-300 p-5 flex items-start gap-3">
              <AlertCircle className="text-rose-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-rose-600 text-sm">Plán není realizovatelný</p>
                <p className="text-xs text-slate-500 mt-1">
                  Při aktuálních parametrech každý klik generuje méně hodnoty, než stojí. Zkuste zvýšit marži, konverzní poměr nebo snížit CPC.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  title="Reklamní rozpočet"
                  value={fmtKc(result.adBudget)}
                  icon={<Wallet size={18} />}
                  sub="měsíčně"
                />
                <StatCard
                  title="Počet objednávek"
                  value={formatNumber(result.requiredConversions)}
                  icon={<ShoppingCart size={18} />}
                  sub="za měsíc"
                />
                <StatCard
                  title="Potřebné prokliky"
                  value={formatNumber(result.requiredClicks)}
                  icon={<MousePointer size={18} />}
                  sub="za měsíc"
                />
                <StatCard
                  title="Potřebný obrat"
                  value={fmtKc(result.requiredRevenue)}
                  icon={<TrendingUp size={18} />}
                  sub="bez DPH / měsíc"
                />
                <StatCard
                  title="CPA (cena za objednávku)"
                  value={fmtKc(result.cpa)}
                  icon={<DollarSign size={18} />}
                />
                <div className={`bg-white rounded-2xl shadow-sm border-2 ${
                  result.pno < inputs.marginPct * 0.5
                    ? 'border-emerald-500'
                    : result.pno < inputs.marginPct
                      ? 'border-amber-400'
                      : 'border-rose-400'
                } p-4 flex items-start justify-between`}>
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 leading-snug">PNO</p>
                    <p className={`text-2xl font-bold leading-tight ${pnoColor}`}>
                      {formatPercent(result.pno, 1)}
                    </p>
                    <p className={`text-xs mt-1 font-medium ${pnoColor}`}>{pnoLabel}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    result.pno < inputs.marginPct * 0.5
                      ? 'bg-emerald-50 text-emerald-600'
                      : result.pno < inputs.marginPct
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-rose-50 text-rose-500'
                  }`}>
                    <Percent size={18} />
                  </div>
                </div>
              </div>

              {/* Quick summary */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Zisk na objednávku (před CPA)</span>
                  <span className="font-semibold">{fmtKc(result.effectiveNetPerOrder)}</span>
                </div>
                <div className="flex justify-between">
                  <span>AOV bez DPH</span>
                  <span className="font-semibold">{fmtKc(result.aovExVat)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nákupní náklady na objednávku</span>
                  <span className="font-semibold">{fmtKc(result.purchaseCostPerOrder)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Charts — only show when feasible */}
      {result && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Chart 1: Rozpad objednávky */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-4">Rozpad objednávky (bez DPH)</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={breakdownData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${Math.round(v / 1000) * 1000 >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v)} Kč`} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  content={(props: any) => (
                    <ChartTooltipBase {...props} formatter={(v: number) => fmtKc(v)} />
                  )}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Nákupní cena" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Fulfillment" stackId="a" fill={C.cost} />
                <Bar dataKey="Reklama (CPA)" stackId="a" fill="#f97316" />
                <Bar dataKey="Fixní náklady" stackId="a" fill={C.cvr} />
                <Bar dataKey="Čistý zisk" stackId="a" fill={C.margin} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 2: Zisk vs. reklamní investice */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-4">Zisk vs. reklamní investice</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={profitVsBudgetData} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="budget"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                  label={{ value: 'Rekl. rozpočet (Kč)', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                />
                <Tooltip
                  content={(props: any) => (
                    <ChartTooltipBase
                      {...props}
                      label={props.label !== undefined ? `Rozpočet: ${fmtKc(props.label)}` : undefined}
                      formatter={(v: number) => fmtKc(v)}
                    />
                  )}
                />
                <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1} />
                <ReferenceLine
                  x={Math.round(result.adBudget)}
                  stroke={C.primary}
                  strokeDasharray="4 3"
                  label={{ value: 'Cílový', position: 'top', fontSize: 10, fill: C.primary }}
                />
                <ReferenceLine
                  y={inputs.targetProfit}
                  stroke={C.margin}
                  strokeDasharray="4 3"
                  label={{ value: `${Math.round(inputs.targetProfit / 1000)}k Kč`, position: 'right', fontSize: 10, fill: C.margin }}
                />
                <Line
                  type="monotone"
                  dataKey="zisk"
                  name="Čistý zisk"
                  stroke={C.grossProfit}
                  dot={false}
                  strokeWidth={2.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 3: Co kdyby scénáře */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Scénáře „Co kdyby"</h3>
            <p className="text-[10px] text-slate-400 mb-4">Potřebný rozpočet při ±20 % změně vstupů (cílový zisk stejný)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={scenariosData}
                layout="vertical"
                margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={v => `${Math.round(v / 1000)}k`}
                />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: '#64748b' }} />
                <ReferenceLine x={Math.round(result.adBudget)} stroke={C.primary} strokeDasharray="4 3" />
                <Tooltip
                  content={(props: any) => (
                    <ChartTooltipBase {...props} formatter={(v: number, name: string) => name === 'Baseline' ? fmtKc(v) : fmtKc(v)} />
                  )}
                />
                <Bar dataKey="rozpočet" name="Rekl. rozpočet" radius={[0, 4, 4, 0]}>
                  {scenariosData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={!entry.feasible ? '#e2e8f0' : entry.better ? C.margin : C.cost}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 4: Citlivost na marži */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Citlivost na marži</h3>
            <p className="text-[10px] text-slate-400 mb-4">Jak se mění potřebný rozpočet a PNO s výší marže</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={marginSensitivityData} margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="marže"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={v => `${v} %`}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={v => `${Math.round(v / 1000)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={v => `${v} %`}
                />
                <ReferenceLine
                  yAxisId="left"
                  x={inputs.marginPct}
                  stroke={C.primary}
                  strokeDasharray="4 3"
                  label={{ value: 'Nyní', position: 'top', fontSize: 10, fill: C.primary }}
                />
                <Tooltip
                  content={(props: any) => (
                    <ChartTooltipBase
                      {...props}
                      label={props.label !== undefined ? `Marže: ${props.label} %` : undefined}
                      formatter={(v: number, name: string) =>
                        name === 'Rekl. rozpočet' ? fmtKc(v) : `${v} %`
                      }
                    />
                  )}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Rekl. rozpočet"
                  stroke={C.primary}
                  dot={false}
                  strokeWidth={2.5}
                  connectNulls={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="PNO %"
                  stroke={C.cvr}
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
    </div>
  );
}
