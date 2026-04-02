'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { FilterState, TimePeriod, EUR_TO_CZK } from '@/data/types';

interface DateRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

interface FiltersContextValue {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  getDateRange: (f: FilterState) => DateRange;
  /** Live EUR→CZK exchange rate. Falls back to 25 until fetched. */
  eurToCzk: number;
}

// Dnešní datum jako UTC půlnoc — zabraňuje posunu dne při .toISOString() v CET/CEST
const _now = new Date();
const TODAY = new Date(Date.UTC(_now.getFullYear(), _now.getMonth(), _now.getDate()));

/** Formátuje Date jako YYYY-MM-DD v lokálním čase (ne UTC). */
export function localIsoDate(d: Date): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Vytvoří Date na UTC půlnoc pro zadaný rok/měsíc/den. */
function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

export function getDateRange(filters: FilterState): DateRange {
  const y = TODAY.getUTCFullYear();
  const mo = TODAY.getUTCMonth();
  const d = TODAY.getUTCDate();

  let start: Date;
  let end: Date;

  switch (filters.timePeriod) {
    case 'current_year': {
      start = utcDay(y, 0, 1);
      end   = utcDay(y, mo, d);
      break;
    }
    case 'current_month': {
      start = utcDay(y, mo, 1);
      end   = utcDay(y, mo, d);
      break;
    }
    case 'last_month': {
      start = utcDay(y, mo - 1, 1);
      end   = utcDay(y, mo, 0);
      break;
    }
    case 'last_14_days': {
      end   = utcDay(y, mo, d);
      start = utcDay(y, mo, d - 13);
      break;
    }
    case 'all_time': {
      start = utcDay(2024, 0, 1);
      end   = utcDay(y, mo, d);
      break;
    }
    case 'last_year': {
      start = utcDay(y - 1, 0, 1);
      end   = utcDay(y - 1, 11, 31);
      break;
    }
    case 'custom': {
      const cs = filters.customStart ? new Date(filters.customStart) : null;
      const ce = filters.customEnd   ? new Date(filters.customEnd)   : null;
      start = cs ? utcDay(cs.getFullYear(), cs.getMonth(), cs.getDate()) : utcDay(y, mo, 1);
      end   = ce ? utcDay(ce.getFullYear(), ce.getMonth(), ce.getDate()) : utcDay(y, mo, d);
      break;
    }
    default: {
      start = utcDay(y, mo, 1);
      end   = utcDay(y, mo, d);
    }
  }

  const prevStart = utcDay(start.getUTCFullYear() - 1, start.getUTCMonth(), start.getUTCDate());
  const prevEnd   = utcDay(end.getUTCFullYear()   - 1, end.getUTCMonth(),   end.getUTCDate());

  return { start, end, prevStart, prevEnd };
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

const defaultFilters: FilterState = {
  countries: ['cz', 'sk'],
  timePeriod: 'current_month',
};

const CACHE_KEY = 'eurToCzk_cache';

function loadCachedRate(): number | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { rate, date } = JSON.parse(raw);
    if (date === new Date().toISOString().split('T')[0]) return rate;
  } catch { /* ignore */ }
  return null;
}

function saveRateCache(rate: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      rate,
      date: new Date().toISOString().split('T')[0],
    }));
  } catch { /* ignore */ }
}

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [eurToCzk, setEurToCzk] = useState<number>(EUR_TO_CZK); // fallback

  useEffect(() => {
    // Try cache first (valid for today)
    const cached = loadCachedRate();
    if (cached) {
      setEurToCzk(cached);
      return;
    }

    // Fetch live rate from frankfurter.app (free, no API key)
    fetch('https://api.frankfurter.app/latest?from=EUR&to=CZK')
      .then(r => r.json())
      .then(data => {
        const rate = data?.rates?.CZK;
        if (typeof rate === 'number' && rate > 0) {
          setEurToCzk(rate);
          saveRateCache(rate);
        }
      })
      .catch(() => { /* keep fallback */ });
  }, []);

  return React.createElement(
    FiltersContext.Provider,
    { value: { filters, setFilters, getDateRange, eurToCzk } },
    children
  );
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}
