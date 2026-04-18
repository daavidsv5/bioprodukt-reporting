import { DailyRecord, Country, EUR_TO_CZK } from './types';
import { realDataCZ } from './realDataCZ';
import { realDataSK } from './realDataSK';

// Real data start dates — earlier dates use mock data for YoY base comparisons
const REAL_CZ_START = '2025-05-25';
const REAL_SK_START = '2024-03-24';

function seededRandom(seed: number): () => number {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function getSeasonalFactor(month: number): number {
  const factors: Record<number, number> = {
    1: 0.70, 2: 0.72, 3: 0.85, 4: 0.90,
    5: 0.95, 6: 0.90, 7: 0.85, 8: 0.88,
    9: 0.95, 10: 1.05, 11: 1.35, 12: 1.50,
  };
  return factors[month] ?? 1.0;
}

function getWeekdayFactor(dayOfWeek: number): number {
  const factors: Record<number, number> = {
    0: 0.80, 1: 0.85, 2: 1.05, 3: 1.10,
    4: 1.10, 5: 1.08, 6: 0.95,
  };
  return factors[dayOfWeek] ?? 1.0;
}

function getYearGrowth(year: number): number {
  if (year === 2024) return 1.0;
  if (year === 2025) return 1.15;
  if (year === 2026) return 1.15 * 1.17;
  return 1.0;
}

function generateRecordsForCountry(country: Country): DailyRecord[] {
  const records: DailyRecord[] = [];
  const rng = seededRandom(country === 'cz' ? 42 : 137);

  const startDate = new Date(2024, 0, 1);
  const endDate = new Date(2026, 2, 14);

  // SK mock base values in EUR, CZ in CZK
  const isSK = country === 'sk';
  const baseRevenue = isSK ? 300 : 19000;  // EUR for SK, CZK for CZ
  const baseOrders  = isSK ? 5 : 27;
  const baseCost    = isSK ? 52 : 3200;
  const vatRate     = isSK ? 1.20 : 1.21;

  const current = new Date(startDate);
  while (current <= endDate) {
    const year      = current.getFullYear();
    const month     = current.getMonth() + 1;
    const dayOfWeek = current.getDay();

    const seasonal   = getSeasonalFactor(month);
    const weekday    = getWeekdayFactor(dayOfWeek);
    const yearGrowth = getYearGrowth(year);
    const noise      = () => 0.70 + rng() * 0.60;

    const revenue = Math.round(baseRevenue * seasonal * weekday * yearGrowth * noise());
    const orders  = Math.max(1, Math.round(baseOrders * seasonal * weekday * yearGrowth * noise()));
    const cost    = Math.round(baseCost * seasonal * weekday * yearGrowth * noise());

    records.push({
      date: current.toISOString().split('T')[0],
      country,
      currency: isSK ? 'EUR' : 'CZK',
      revenue,
      revenue_vat: Math.round(revenue * vatRate * 100) / 100,
      orders,
      orders_cancelled: 0,
      cost,
    });

    current.setDate(current.getDate() + 1);
  }

  return records;
}

// CZ: real data only — e-shop launched May 2025, no prior year data exists
const realCZ: DailyRecord[] = realDataCZ.map(r => ({
  date: r.date, country: r.country, currency: 'CZK' as const,
  orders: r.orders, orders_cancelled: r.orders_cancelled, revenue_vat: r.revenue_vat, revenue: r.revenue, cost: r.cost,
}));

// SK: mock before real data start (EUR scale, for YoY base), then real data
const mockSK = generateRecordsForCountry('sk').filter(r => r.date < REAL_SK_START);
const realSK: DailyRecord[] = realDataSK.map(r => ({
  date: r.date, country: r.country, currency: 'EUR' as const,
  orders: r.orders, orders_cancelled: r.orders_cancelled, revenue_vat: r.revenue_vat, revenue: r.revenue, cost: r.cost,
}));

export const mockData: DailyRecord[] = [
  ...realCZ,
  ...mockSK, ...realSK,
];

// Daily marketing data with per-channel breakdown
export interface DailyMarketingRow {
  date: string;
  cost: number;
  cost_facebook: number;
  cost_google: number;
  cost_seznam: number;
  clicks_facebook: number;
  clicks_google: number;
  clicks_seznam: number;
  orders: number;
  revenue: number;
}

export function getDailyMarketingData(
  dateStart: string,
  dateEnd: string,
  countries: string[],
  eurToCzk: number = EUR_TO_CZK
): DailyMarketingRow[] {
  const onlySK = countries.length === 1 && countries[0] === 'sk';
  const skMult = onlySK ? 1 : eurToCzk;

  const byDate: Record<string, DailyMarketingRow> = {};

  const ensure = (date: string) => {
    if (!byDate[date]) {
      byDate[date] = { date, cost: 0, cost_facebook: 0, cost_google: 0, cost_seznam: 0, clicks_facebook: 0, clicks_google: 0, clicks_seznam: 0, orders: 0, revenue: 0 };
    }
  };

  if (countries.includes('cz')) {
    for (const r of realDataCZ.filter(d => d.date >= dateStart && d.date <= dateEnd)) {
      ensure(r.date);
      byDate[r.date].cost          += r.cost;
      byDate[r.date].cost_facebook += r.cost_facebook;
      byDate[r.date].cost_google   += r.cost_google;
      byDate[r.date].cost_seznam   += (r as any).cost_seznam   ?? 0;
      byDate[r.date].clicks_facebook += r.clicks_facebook;
      byDate[r.date].clicks_google   += r.clicks_google;
      byDate[r.date].clicks_seznam   += (r as any).clicks_seznam ?? 0;
      byDate[r.date].orders          += r.orders;
      byDate[r.date].revenue         += r.revenue;
    }
  }

  if (countries.includes('sk')) {
    for (const r of realDataSK.filter(d => d.date >= dateStart && d.date <= dateEnd)) {
      ensure(r.date);
      byDate[r.date].cost          += r.cost          * skMult;
      byDate[r.date].cost_facebook += r.cost_facebook * skMult;
      byDate[r.date].cost_google   += r.cost_google   * skMult;
      byDate[r.date].cost_seznam   += ((r as any).cost_seznam   ?? 0) * skMult;
      byDate[r.date].clicks_facebook += r.clicks_facebook;
      byDate[r.date].clicks_google   += r.clicks_google;
      byDate[r.date].clicks_seznam   += (r as any).clicks_seznam ?? 0;
      byDate[r.date].orders          += r.orders;
      byDate[r.date].revenue         += r.revenue      * skMult;
    }
  }

  return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
}

// Source breakdown for marketing page
export interface MarketingSource {
  source: string;
  cost: number;
  currency: 'CZK' | 'EUR';
  clicks: number;
  orders: number;
  revenue: number;
  pno: number;
  cpa: number;
}

function buildSourceBreakdown(
  fbCost: number, gCost: number, szCost: number,
  fbClicks: number, gClicks: number, szClicks: number,
  totalRevenue: number, totalOrders: number,
  currency: 'CZK' | 'EUR'
): MarketingSource[] {
  const totalCost = fbCost + gCost + szCost;
  const mkShare   = (c: number) => totalCost > 0 ? c / totalCost : 0;
  const safeDiv   = (a: number, b: number) => b > 0 ? a / b : 0;

  const entries = [
    { source: 'Facebook Ads', cost: fbCost, clicks: fbClicks },
    { source: 'Google Ads',   cost: gCost,  clicks: gClicks  },
    { source: 'Seznam Ads',   cost: szCost, clicks: szClicks },
  ];

  return entries
    .filter(e => e.cost > 0 || e.clicks > 0)
    .map(e => ({
      source: e.source, currency,
      cost: e.cost, clicks: e.clicks,
      orders:  Math.round(totalOrders  * mkShare(e.cost)),
      revenue: Math.round(totalRevenue * mkShare(e.cost)),
      pno: safeDiv(e.cost, totalRevenue * mkShare(e.cost)) * 100,
      cpa: safeDiv(e.cost, totalOrders  * mkShare(e.cost)),
    }));
}

export function getMarketingSourceData(
  dateStart: string,
  dateEnd: string,
  countries: string[],
  eurToCzk: number = EUR_TO_CZK
): MarketingSource[] {
  const onlySK = countries.length === 1 && countries[0] === 'sk';
  // When mixing CZ+SK, convert SK EUR values to CZK for unified display
  const skMultiplier = onlySK ? 1 : eurToCzk;
  const displayCurrency: 'CZK' | 'EUR' = onlySK ? 'EUR' : 'CZK';

  let fbCost = 0, gCost = 0, szCost = 0;
  let fbClicks = 0, gClicks = 0, szClicks = 0;
  let totalRevenue = 0, totalOrders = 0;

  if (countries.includes('cz')) {
    const r = realDataCZ.filter(d => d.date >= dateStart && d.date <= dateEnd);
    fbCost       += r.reduce((s, d) => s + d.cost_facebook, 0);
    gCost        += r.reduce((s, d) => s + d.cost_google, 0);
    szCost       += r.reduce((s, d) => s + ((d as any).cost_seznam   ?? 0), 0);
    fbClicks     += r.reduce((s, d) => s + d.clicks_facebook, 0);
    gClicks      += r.reduce((s, d) => s + d.clicks_google, 0);
    szClicks     += r.reduce((s, d) => s + ((d as any).clicks_seznam ?? 0), 0);
    totalRevenue += r.reduce((s, d) => s + d.revenue, 0);
    totalOrders  += r.reduce((s, d) => s + d.orders, 0);
  }

  if (countries.includes('sk')) {
    const r = realDataSK.filter(d => d.date >= dateStart && d.date <= dateEnd);
    fbCost       += r.reduce((s, d) => s + d.cost_facebook, 0)           * skMultiplier;
    gCost        += r.reduce((s, d) => s + d.cost_google, 0)             * skMultiplier;
    szCost       += r.reduce((s, d) => s + ((d as any).cost_seznam ?? 0), 0) * skMultiplier;
    fbClicks     += r.reduce((s, d) => s + d.clicks_facebook, 0);
    gClicks      += r.reduce((s, d) => s + d.clicks_google, 0);
    szClicks     += r.reduce((s, d) => s + ((d as any).clicks_seznam ?? 0), 0);
    totalRevenue += r.reduce((s, d) => s + d.revenue, 0)                 * skMultiplier;
    totalOrders  += r.reduce((s, d) => s + d.orders, 0);
  }

  return buildSourceBreakdown(fbCost, gCost, szCost, fbClicks, gClicks, szClicks, totalRevenue, totalOrders, displayCurrency);
}
