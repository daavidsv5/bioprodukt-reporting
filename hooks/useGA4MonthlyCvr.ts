'use client';

import { useState, useEffect } from 'react';

const MONTH_LABELS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

export interface MonthCvrPoint {
  label: string;
  cvr: number | null;
  cvr_prev: number | null;
}

interface DailyRow {
  date: string;
  sessions: number;
  conversions: number;
}

function groupByMonth(rows: DailyRow[]): Map<number, { sessions: number; conversions: number }> {
  const map = new Map<number, { sessions: number; conversions: number }>();
  for (let m = 1; m <= 12; m++) map.set(m, { sessions: 0, conversions: 0 });
  for (const r of rows) {
    // GA4 dates arrive in YYYYMMDD format
    const m = parseInt(r.date.substring(4, 6), 10);
    if (m >= 1 && m <= 12) {
      const acc = map.get(m)!;
      acc.sessions += r.sessions;
      acc.conversions += r.conversions;
    }
  }
  return map;
}

export function useGA4MonthlyCvr(
  year: number,
  country: string,
): { data: MonthCvrPoint[] | null; loading: boolean; error: boolean } {
  const [data, setData] = useState<MonthCvrPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (country === 'sk') {
      setData(null);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    fetch(`/api/analytics/monthly-cvr?year=${year}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) {
          console.error('GA4 CVR API error:', json);
          throw new Error(json?.error ?? `HTTP ${r.status}`);
        }
        return json as { daily?: DailyRow[]; dailyPrev?: DailyRow[] };
      })
      .then((json) => {
        const curr = groupByMonth(json.daily ?? []);
        const prev = groupByMonth(json.dailyPrev ?? []);
        const points: MonthCvrPoint[] = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const c = curr.get(m)!;
          const p = prev.get(m)!;
          return {
            label: MONTH_LABELS[i],
            cvr: c.sessions > 0 ? Math.round((c.conversions / c.sessions) * 10000) / 100 : null,
            cvr_prev: p.sessions > 0 ? Math.round((p.conversions / p.sessions) * 10000) / 100 : null,
          };
        });
        setData(points);
      })
      .catch((err) => {
        console.error('useGA4MonthlyCvr error:', err);
        setError(true);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [year, country]);

  return { data, loading, error };
}
