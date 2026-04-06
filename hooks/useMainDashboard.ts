import { useMemo } from 'react';
import { realDataCZ } from '@/data/realDataCZ';
import { realDataSK } from '@/data/realDataSK';
import { marginDataCZ } from '@/data/marginDataCZ';
import { marginDataSK } from '@/data/marginDataSK';
import { EUR_TO_CZK } from '@/data/types';

export type MainCountry = 'cz' | 'sk' | 'all';

export interface MonthlyPoint {
  month: number;        // 1–12
  label: string;        // 'Led', 'Úno', …
  // aktuální rok
  revenue: number | null;
  cost: number | null;
  pno: number | null;
  aov: number | null;
  marginPct: number | null;
  cpa: number | null;
  orders: number | null;
  grossProfit: number | null;
  // předchozí rok
  revenue_prev: number | null;
  cost_prev: number | null;
  pno_prev: number | null;
  aov_prev: number | null;
  marginPct_prev: number | null;
  cpa_prev: number | null;
  orders_prev: number | null;
  grossProfit_prev: number | null;
}

const MONTH_LABELS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

interface AggDay {
  revenue: number;
  cost: number;
  orders: number;
}

interface AggMargin {
  purchaseCost: number;
  revenue: number;
}

interface MonthAgg {
  day: AggDay;
  margin: AggMargin;
}

function aggregateByMonth(
  realData: { date: string; revenue: number; cost: number; orders: number }[],
  marginData: { date: string; purchaseCost: number; revenue: number }[],
  yearStr: string,
  multiplier = 1,
): Map<number, MonthAgg> {
  const result = new Map<number, MonthAgg>();

  for (let m = 1; m <= 12; m++) {
    result.set(m, { day: { revenue: 0, cost: 0, orders: 0 }, margin: { purchaseCost: 0, revenue: 0 } });
  }

  for (const r of realData) {
    if (!r.date.startsWith(yearStr)) continue;
    const m = parseInt(r.date.substring(5, 7), 10);
    const acc = result.get(m)!;
    acc.day.revenue += r.revenue * multiplier;
    acc.day.cost    += r.cost * multiplier;
    acc.day.orders  += r.orders;
  }

  for (const r of marginData) {
    if (!r.date.startsWith(yearStr)) continue;
    const m = parseInt(r.date.substring(5, 7), 10);
    const acc = result.get(m)!;
    acc.margin.purchaseCost += r.purchaseCost * multiplier;
    acc.margin.revenue      += r.revenue * multiplier;
  }

  return result;
}

function mergeAgg(a: Map<number, MonthAgg>, b: Map<number, MonthAgg>): Map<number, MonthAgg> {
  const result = new Map<number, MonthAgg>();
  for (let m = 1; m <= 12; m++) {
    const ma = a.get(m)!;
    const mb = b.get(m)!;
    result.set(m, {
      day: {
        revenue: ma.day.revenue + mb.day.revenue,
        cost:    ma.day.cost    + mb.day.cost,
        orders:  ma.day.orders  + mb.day.orders,
      },
      margin: {
        purchaseCost: ma.margin.purchaseCost + mb.margin.purchaseCost,
        revenue:      ma.margin.revenue      + mb.margin.revenue,
      },
    });
  }
  return result;
}

function toPoint(agg: MonthAgg | undefined): {
  revenue: number | null; cost: number | null; pno: number | null;
  aov: number | null; marginPct: number | null; cpa: number | null;
  orders: number | null; grossProfit: number | null;
} {
  if (!agg || agg.day.orders === 0) {
    if (agg && agg.day.revenue > 0) {
      const marginPct = agg.margin.revenue > 0
        ? ((agg.margin.revenue - agg.margin.purchaseCost) / agg.margin.revenue) * 100
        : null;
      const margin = agg.margin.revenue > 0 ? agg.margin.revenue - agg.margin.purchaseCost : null;
      const grossProfit = margin !== null ? margin - agg.day.cost : null;
      return {
        revenue:   agg.day.revenue,
        cost:      agg.day.cost,
        pno:       agg.day.cost > 0 && agg.day.revenue > 0 ? (agg.day.cost / agg.day.revenue) * 100 : null,
        aov:       null,
        marginPct,
        cpa:       null,
        orders:    agg.day.orders,
        grossProfit,
      };
    }
    return { revenue: null, cost: null, pno: null, aov: null, marginPct: null, cpa: null, orders: null, grossProfit: null };
  }

  const { revenue, cost, orders } = agg.day;
  const marginPct = agg.margin.revenue > 0
    ? ((agg.margin.revenue - agg.margin.purchaseCost) / agg.margin.revenue) * 100
    : null;
  const margin = agg.margin.revenue > 0 ? agg.margin.revenue - agg.margin.purchaseCost : null;
  const grossProfit = margin !== null ? margin - cost : null;

  return {
    revenue,
    cost,
    orders,
    pno:      revenue > 0 ? (cost / revenue) * 100 : null,
    aov:      orders > 0  ? revenue / orders         : null,
    cpa:      orders > 0  ? cost / orders            : null,
    marginPct,
    grossProfit,
  };
}

export function useMainDashboard(country: MainCountry, year: number): MonthlyPoint[] {
  return useMemo(() => {
    const currStr = String(year);
    const prevStr = String(year - 1);

    let curr: Map<number, MonthAgg>;
    let prev: Map<number, MonthAgg>;

    if (country === 'all') {
      const rate = EUR_TO_CZK;
      const czCurr = aggregateByMonth(realDataCZ, marginDataCZ, currStr);
      const skCurr = aggregateByMonth(realDataSK, marginDataSK, currStr, rate);
      const czPrev = aggregateByMonth(realDataCZ, marginDataCZ, prevStr);
      const skPrev = aggregateByMonth(realDataSK, marginDataSK, prevStr, rate);
      curr = mergeAgg(czCurr, skCurr);
      prev = mergeAgg(czPrev, skPrev);
    } else {
      const realData   = country === 'cz' ? realDataCZ   : realDataSK;
      const marginData = country === 'cz' ? marginDataCZ : marginDataSK;
      curr = aggregateByMonth(realData, marginData, currStr);
      prev = aggregateByMonth(realData, marginData, prevStr);
    }

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const c = toPoint(curr.get(m));
      const p = toPoint(prev.get(m));
      return {
        month: m,
        label: MONTH_LABELS[i],
        revenue:        c.revenue,
        cost:           c.cost,
        pno:            c.pno,
        aov:            c.aov,
        marginPct:      c.marginPct,
        cpa:            c.cpa,
        orders:         c.orders,
        grossProfit:    c.grossProfit,
        revenue_prev:   p.revenue,
        cost_prev:      p.cost,
        pno_prev:       p.pno,
        aov_prev:       p.aov,
        marginPct_prev: p.marginPct,
        cpa_prev:       p.cpa,
        orders_prev:    p.orders,
        grossProfit_prev: p.grossProfit,
      };
    });
  }, [country, year]);
}
