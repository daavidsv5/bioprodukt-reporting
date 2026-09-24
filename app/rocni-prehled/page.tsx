'use client';

import { useEffect, useMemo, useState } from 'react';
import { realDataCZ } from '@/data/realDataCZ';
import { realDataSK } from '@/data/realDataSK';
import { CZ_PURCHASE_COST_FROM } from '@/data/types';
import { useRocniPrehled } from '@/hooks/useRocniPrehled';
import { aggregateKpiYear } from '@/hooks/useMainDashboard';
import { deriveKpi, type KpiMetrics } from '@/lib/kpiMetrics';
import {
  CURRENT_YEAR, CUTOFF_DATE, CUTOFF_LABEL, getYearInfos, periodFilter,
  type YearPeriod,
} from '@/lib/rocniPrehled';
import {
  YearChartCard, buildYearPoints, DeviceSelect, type ChangeKind, type Device,
  fmtMoney, fmtCount, fmtPct2, fmtAxisMoney, fmtAxisCount, fmtAxisPct,
} from '@/components/charts/YearChartCard';

type Ga4Year = { year: number; sessions: number; conversions: number };
/** Hrubý zisk a marže jsou null, pokud za období chybí data o marži (stejně jako na Měsíčním přehledu) */
type YearMetrics = Omit<KpiMetrics, 'grossProfit' | 'marginPct'> & { grossProfit: number | null; marginPct: number | null };

const fmtCZK = fmtMoney('Kč');
const fmtEUR = fmtMoney('€');

export default function RocniPrehledPage() {
  const { yearInfos: allYearInfos, selectedYears, country } = useRocniPrehled();
  const [device, setDevice] = useState<Device>('all');
  const [ga4, setGa4] = useState<Ga4Year[] | null>(null);
  const [ga4PrevYtd, setGa4PrevYtd] = useState<Ga4Year | null>(null);
  const fmtCur = country === 'sk' ? fmtEUR : fmtCZK;
  const showGa4 = country !== 'sk';

  // Neúplné roky podle zvoleného trhu
  const yearInfos = useMemo(() => getYearInfos(
    country === 'cz' ? realDataCZ : country === 'sk' ? realDataSK : [...realDataCZ, ...realDataSK],
  ), [country]);

  const metricsFor = useMemo(() => {
    const cache: Record<string, YearMetrics> = {};
    return (year: number, period: YearPeriod): YearMetrics => {
      const key = `${year}-${period}`;
      if (!cache[key]) {
        const row = aggregateKpiYear(country, year, periodFilter(period));
        const k = deriveKpi(row);
        const hasMargin = row.marginRev > 0;
        cache[key] = { ...k, grossProfit: hasMargin ? k.grossProfit : null, marginPct: hasMargin ? k.marginPct : null };
      }
      return cache[key];
    };
  }, [country]);

  const known = useMemo(() => new Set(allYearInfos.map(y => y.year)), [allYearInfos]);

  useEffect(() => {
    setGa4(null);
    if (!showGa4) return;
    const years = allYearInfos.map(y => y.year).join(',');
    fetch(`/api/analytics/yearly?years=${years}&cutoff=${CUTOFF_DATE}&period=full&device=${device}`)
      .then(r => r.json())
      .then(json => { if (Array.isArray(json.years)) setGa4(json.years); })
      .catch(() => {});
    fetch(`/api/analytics/yearly?years=${CURRENT_YEAR - 1}&cutoff=${CUTOFF_DATE}&period=ytd&device=${device}`)
      .then(r => r.json())
      .then(json => { if (Array.isArray(json.years) && json.years[0]) setGa4PrevYtd(json.years[0]); })
      .catch(() => {});
  }, [allYearInfos, device, showGa4]);

  const ga4ByYear = useMemo(() => {
    const out: Record<number, Ga4Year> = {};
    for (const g of ga4 ?? []) out[g.year] = g;
    return out;
  }, [ga4]);

  const sessionsOf = (g?: Ga4Year | null) => (g && g.sessions > 0 ? g.sessions : null);
  const cvrOf = (g?: Ga4Year | null) => (g && g.sessions > 0 ? (g.conversions / g.sessions) * 100 : null);

  const kpi = (key: keyof YearMetrics, kind: ChangeKind) => buildYearPoints({
    selectedYears, yearInfos, kind,
    getValue: y => (known.has(y) ? metricsFor(y, 'full')[key] : null),
    prevYtdValue: known.has(CURRENT_YEAR - 1) ? metricsFor(CURRENT_YEAR - 1, 'ytd')[key] : null,
  });

  const ga4Points = (pick: (g?: Ga4Year | null) => number | null, kind: ChangeKind) => buildYearPoints({
    selectedYears, yearInfos, kind,
    getValue: y => pick(ga4ByYear[y]),
    prevYtdValue: pick(ga4PrevYtd),
  });

  // CZ nákupní ceny až od CZ_PURCHASE_COST_FROM → dřívější marže a hrubý zisk jsou nadhodnocené
  const czCostYear = +CZ_PURCHASE_COST_FROM.slice(0, 4);
  const marginWarning = country !== 'sk' && selectedYears.some(y => y <= czCostYear)
    ? `⚠ CZ bez nákupních cen před ${+CZ_PURCHASE_COST_FROM.slice(5, 7)}/${czCostYear}, roky do ${czCostYear} jsou nadhodnocené`
    : undefined;

  const selectedPartial = yearInfos.filter(y => y.partial && selectedYears.includes(y.year));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Roční přehled</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Srovnání klíčových metrik po letech{country === 'sk' ? ' v EUR' : country === 'all' ? ', SK přepočteno na Kč' : ''} · minulé roky celé, {CURRENT_YEAR} od 1. 1. do {CUTOFF_LABEL}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Číslo nad sloupcem ukazuje změnu proti předchozímu roku, u minulých let celý rok proti celému roku. Rok {CURRENT_YEAR} se srovnává se stejným obdobím {CURRENT_YEAR - 1}, tedy 1. 1. až {CUTOFF_LABEL} (poslední kompletní den dat). U PNO, marže a konverzního poměru jde o rozdíl v procentních bodech.
        </p>
        {selectedPartial.map(y => {
          const [yy, mm, dd] = y.firstOrderDate.split('-').map(Number);
          return (
            <p key={y.year} className="text-xs text-amber-600 font-medium mt-1">
              ⚠ Rok {y.year} obsahuje objednávky až od {dd}. {mm}. {yy}, proto u něj ani u roku {y.year + 1} změnu nepočítáme.
            </p>
          );
        })}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <YearChartCard title="Tržby bez DPH" data={kpi('revenue', 'pct')}
          colorCurrent="#2563eb" colorOther="#93c5fd" changeKind="pct"
          axisFormatter={fmtAxisMoney} valueFormatter={fmtCur} />
        <YearChartCard title="Hrubý zisk" data={kpi('grossProfit', 'pct')}
          subtitle={marginWarning} subtitleWarning={!!marginWarning}
          colorCurrent="#16a34a" colorOther="#86efac" changeKind="pct"
          axisFormatter={fmtAxisMoney} valueFormatter={fmtCur} />
        <YearChartCard title="Počet objednávek" data={kpi('orders', 'pct')}
          colorCurrent="#1e40af" colorOther="#93c5fd" changeKind="pct"
          axisFormatter={fmtAxisCount} valueFormatter={fmtCount} />
        <YearChartCard title="Marketingové investice" data={kpi('cost', 'pct')}
          colorCurrent="#dc2626" colorOther="#fca5a5" changeKind="pct" lowerIsBetter
          axisFormatter={fmtAxisMoney} valueFormatter={fmtCur} />
        <YearChartCard title="PNO (%)" data={kpi('pno', 'pp')}
          colorCurrent="#0891b2" colorOther="#67e8f9" changeKind="pp" lowerIsBetter
          axisFormatter={fmtAxisPct} valueFormatter={fmtPct2} />
        <YearChartCard title="AOV, průměrná hodnota objednávky" subtitle="Bez DPH" data={kpi('aov', 'pct')}
          colorCurrent="#4338ca" colorOther="#a5b4fc" changeKind="pct"
          axisFormatter={fmtAxisMoney} valueFormatter={fmtCur} />
        <YearChartCard title="Marže (%)" data={kpi('marginPct', 'pp')}
          subtitle={marginWarning} subtitleWarning={!!marginWarning}
          colorCurrent="#15803d" colorOther="#86efac" changeKind="pp"
          axisFormatter={fmtAxisPct} valueFormatter={fmtPct2} />
        <YearChartCard title="Cena za objednávku (CPA)" data={kpi('cpa', 'pct')}
          colorCurrent="#7c3aed" colorOther="#c4b5fd" changeKind="pct" lowerIsBetter
          axisFormatter={fmtAxisMoney} valueFormatter={fmtCur} />
        {showGa4 && ga4 && (
          <YearChartCard title="Návštěvnost webu" subtitle="Zdroj GA4, pouze CZ"
            data={ga4Points(sessionsOf, 'pct')}
            colorCurrent="#1d4ed8" colorOther="#93c5fd" changeKind="pct"
            axisFormatter={fmtAxisCount} valueFormatter={fmtCount}
            headerRight={<DeviceSelect value={device} onChange={setDevice} />} />
        )}
        {showGa4 && ga4 && (
          <YearChartCard title="Konverzní poměr" subtitle="Zdroj GA4, pouze CZ"
            data={ga4Points(cvrOf, 'pp')}
            colorCurrent="#0891b2" colorOther="#a5f3fc" changeKind="pp"
            axisFormatter={fmtAxisPct} valueFormatter={fmtPct2}
            headerRight={<DeviceSelect value={device} onChange={setDevice} />} />
        )}
      </div>
    </div>
  );
}
