'use client';

/**
 * Aktuální hodnoty pro Slovník klíčových metrik (/slovnik): posledních 12 měsíců.
 * Vzorce odpovídají Hlavním KPI (`app/dashboard/page.tsx`).
 */

import { useMemo } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { realDataCZ } from '@/data/realDataCZ';
import { realDataSK } from '@/data/realDataSK';
import { marginDataCZ } from '@/data/marginDataCZ';
import { marginDataSK } from '@/data/marginDataSK';
import { retentionDataCZ } from '@/data/retentionDataCZ';
import { retentionDataSK } from '@/data/retentionDataSK';
import { computeRetentionKpis } from '@/lib/retentionUtils';
import type { CurrentValueKey } from '@/lib/metricsGlossary';

export type CurrentValues = Partial<Record<CurrentValueKey, number | null>>;

export interface Customer { dates: string[]; revenues: number[]; revsVat: number[] }

/** Posledních 12 měsíců končících včera (stejně jako otevřená období v TopBaru). */
export function last12Months() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  start.setDate(start.getDate() + 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start, end, s: iso(start), e: iso(end) };
}

interface Inputs {
  revenue: number; revenueVat: number; orders: number; cost: number;
  aovWithVat: boolean;
  /** null = projekt nemá nákupní ceny */
  margin: { revenue: number; purchaseCost: number } | null;
  /** zákazníci s daty seřazenými vzestupně, tržby v měně reportu */
  customers: Customer[];
  s: string; e: string;
  costNoBrand?: number;
}

export function computeValues(i: Inputs): CurrentValues {
  const { revenue, revenueVat, orders, cost, customers } = i;
  const newCustomers = customers.filter(c => c.dates[0] >= i.s && c.dates[0] <= i.e).length;
  const ltvRevenue   = customers.reduce((sum, c) => sum + c.revenues.reduce((a, v) => a + v, 0), 0);
  const retention    = computeRetentionKpis(customers);
  const cac          = newCustomers > 0 ? cost / newCustomers : null;
  const ltv          = customers.length > 0 ? ltvRevenue / customers.length : null;

  const v: CurrentValues = {
    revenueVat, revenue, orders, cost,
    aov:         orders > 0 ? (i.aovWithVat ? revenueVat : revenue) / orders : null,
    pno:         revenue > 0 ? (cost / revenue) * 100 : null,
    cpa:         orders > 0 ? cost / orders : null,
    cac, ltv,
    repeatRate:  customers.length > 0 ? retention.repeatPurchaseRate : null,
    daysBetween: retention.avgDaysBetween > 0 ? retention.avgDaysBetween : null,
  };

  if (i.costNoBrand !== undefined) {
    v.costNoBrand = i.costNoBrand;
    v.pnoNoBrand  = revenue > 0 ? (i.costNoBrand / revenue) * 100 : null;
  }

  if (i.margin && i.margin.revenue > 0) {
    const margin      = i.margin.revenue - i.margin.purchaseCost;
    const marginPct   = (margin / i.margin.revenue) * 100;
    const grossProfit = margin - cost;
    const ltvProfit   = ltv !== null ? ltv * (marginPct / 100) : null;
    Object.assign(v, {
      margin, marginPct, grossProfit,
      grossPct:            (grossProfit / i.margin.revenue) * 100,
      grossPerOrder:       orders > 0 ? grossProfit / orders : null,
      grossPerNewCustomer: newCustomers > 0 ? grossProfit / newCustomers : null,
      poas:                cost > 0 ? margin / cost : null,
      poasNoBrand:         i.costNoBrand ? margin / i.costNoBrand : null,
      ltvProfit,
      ltvCac:              ltvProfit !== null && cac ? ltvProfit / cac : null,
    });
  }
  return v;
}

export function useCurrentValues() {
  const { eurToCzk } = useFilters();
  return useMemo(() => {
    const { start, end, s, e } = last12Months();
    let revenue = 0, revenueVat = 0, orders = 0, cost = 0;
    // Jen reálná data (mockData obsahuje i generovaná SK data před spuštěním SK)
    for (const [rows, mult] of [[realDataCZ, 1], [realDataSK, eurToCzk]] as const) {
      for (const r of rows) {
        if (r.date < s || r.date > e) continue;
        revenue += r.revenue * mult; revenueVat += r.revenue_vat * mult; orders += r.orders; cost += r.cost * mult;
      }
    }
    let marginRev = 0, purchaseCost = 0;
    for (const r of marginDataCZ) if (r.date >= s && r.date <= e) { marginRev += r.revenue; purchaseCost += r.purchaseCost; }
    for (const r of marginDataSK) if (r.date >= s && r.date <= e) { marginRev += r.revenue * eurToCzk; purchaseCost += r.purchaseCost * eurToCzk; }
    const customers = [
      ...retentionDataCZ,
      ...retentionDataSK.map(c => ({ ...c, revenues: c.revenues.map(v => v * eurToCzk), revsVat: c.revsVat.map(v => v * eurToCzk) })),
    ];
    const values = computeValues({
      revenue, revenueVat, orders, cost, aovWithVat: true,
      margin: { revenue: marginRev, purchaseCost }, customers, s, e,
    });
    return { values, start, end, loading: false };
  }, [eurToCzk]);
}
