'use client';

import { useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { FilterState, Country, TimePeriod } from '@/data/types';
import { getDateRange } from '@/hooks/useFilters';
import { formatDate } from '@/lib/formatters';
import { RefreshCw, Menu, Clock } from 'lucide-react';
import { useSidebar } from './ConditionalLayout';
import { LAST_UPDATE } from '@/data/lastUpdate';

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Array.from({ length: CURRENT_YEAR - 2023 }, (_, i) => 2024 + i).reverse();

interface TopBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

const periodLabels: Record<TimePeriod, string> = {
  current_year:  'Aktuální rok',
  current_month: 'Aktuální měsíc',
  last_month:    'Minulý měsíc',
  last_14_days:  'Posledních 14 dní',
  last_year:     'Minulý rok',
  all_time:      'Celé období',
  custom:        'Vlastní období',
};

export default function TopBar({ filters, onChange }: TopBarProps) {
  const { start, end } = getDateRange(filters);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const { toggle } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isRetention = pathname === '/retention' || pathname === '/crosssell';
  const isAnalytics = pathname === '/analytics';
  const isMainDashboard = pathname === '/main';

  // Main dashboard local controls (via URL params)
  const mainCountry = (searchParams.get('country') ?? 'cz') as 'cz' | 'sk';
  const mainYear = Number(searchParams.get('year') ?? CURRENT_YEAR);

  const setMainParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`/main?${params.toString()}`, { scroll: false });
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateMsg(null);
    try {
      const res = await fetch('/api/update', { method: 'POST' });
      const json = await res.json();
      setUpdateMsg(json.ok ? 'Data aktualizována — obnovte stránku.' : 'Chyba při aktualizaci.');
    } catch {
      setUpdateMsg('Chyba při aktualizaci.');
    } finally {
      setUpdating(false);
    }
  };

  const handlePeriodChange = (period: TimePeriod) => {
    onChange({ ...filters, timePeriod: period });
  };

  const handleCustomDate = (field: 'customStart' | 'customEnd', val: string) => {
    onChange({ ...filters, [field]: val ? new Date(val) : undefined });
  };

  const toInputValue = (d?: Date) => {
    if (!d) return '';
    return d.toISOString().split('T')[0];
  };

  return (
    <div className="bg-white border-b border-slate-100 px-3 md:px-6 py-2.5 md:py-3">
      {/* Single row — wraps on smaller screens */}
      <div className="flex items-center gap-2 md:gap-4 flex-wrap">

        {/* Hamburger — mobile only */}
        <button
          onClick={toggle}
          className="md:hidden p-1.5 -ml-0.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
          aria-label="Otevřít menu"
        >
          <Menu size={20} />
        </button>

        {/* Main dashboard controls — CZ/SK + rok */}
        {isMainDashboard && (
          <>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white flex-shrink-0">
              {(['cz', 'sk'] as const).map((c, idx) => (
                <button
                  key={c}
                  onClick={() => setMainParam('country', c)}
                  className={`px-3 md:px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
                    idx > 0 ? 'border-l border-slate-200' : ''
                  } ${mainCountry === c ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {c === 'cz' ? '🇨🇿 CZ' : '🇸🇰 SK'}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-slate-100 hidden md:block flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">Rok:</span>
              <select
                value={mainYear}
                onChange={e => setMainParam('year', e.target.value)}
                className="border border-slate-200 rounded-lg px-2 md:px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {AVAILABLE_YEARS.map(y => (
                  <option key={y} value={y}>{y} vs. {y - 1}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Country segmented control — hidden on retention + main dashboard page */}
        {!isRetention && !isMainDashboard && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Trh:</span>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
              {([
                { label: 'Vše', value: 'all' },
                { label: '🇨🇿', value: 'cz' },
                { label: '🇸🇰', value: 'sk' },
              ] as { label: string; value: 'all' | Country }[])
              .filter(({ value }) => !isAnalytics || value === 'cz')
              .map(({ label, value }, idx) => {
                const isActive =
                  value === 'all'
                    ? filters.countries.length === 2
                    : filters.countries.length === 1 && filters.countries[0] === value;
                const select = () => {
                  if (value === 'all') onChange({ ...filters, countries: ['cz', 'sk'] });
                  else onChange({ ...filters, countries: [value as Country] });
                };
                return (
                  <button
                    key={value}
                    onClick={select}
                    className={`px-2.5 md:px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
                      idx > 0 ? 'border-l border-slate-200' : ''
                    } ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="sm:hidden">{label}</span>
                    <span className="hidden sm:inline">
                      {value === 'all' ? 'Vše' : value === 'cz' ? '🇨🇿 CZ' : '🇸🇰 SK'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Divider — desktop only */}
        {!isRetention && !isMainDashboard && <div className="h-6 w-px bg-slate-100 hidden md:block flex-shrink-0" />}

        {/* Time period — hidden on main dashboard */}
        {!isMainDashboard && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Období:</span>
            <select
              value={filters.timePeriod}
              onChange={(e) => handlePeriodChange(e.target.value as TimePeriod)}
              className="border border-slate-200 rounded-lg px-2 md:px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {(Object.keys(periodLabels) as TimePeriod[]).map((p) => (
                <option key={p} value={p}>{periodLabels[p]}</option>
              ))}
            </select>
          </div>
        )}

        {/* Custom date range */}
        {!isMainDashboard && filters.timePeriod === 'custom' && (
          <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
            <input
              type="date"
              value={toInputValue(filters.customStart)}
              onChange={(e) => handleCustomDate('customStart', e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-xs">–</span>
            <input
              type="date"
              value={toInputValue(filters.customEnd)}
              onChange={(e) => handleCustomDate('customEnd', e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Date range label — hidden on main dashboard */}
        {!isMainDashboard && (
          <div className="text-xs md:text-sm text-slate-500 hidden sm:block flex-shrink-0">
            <span className="font-medium text-slate-700">{formatDate(start)}</span>
            <span className="mx-1.5 text-slate-300">–</span>
            <span className="font-medium text-slate-700">{formatDate(end)}</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Last update timestamp */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0">
          <Clock size={12} />
          <span>Aktualizováno: <span className="text-slate-600 font-medium">{new Date(LAST_UPDATE).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
        </div>

        {/* Update button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {updateMsg && (
            <span className={`text-xs font-medium hidden sm:inline ${updateMsg.startsWith('Chyba') ? 'text-rose-500' : 'text-emerald-600'}`}>
              {updateMsg}
            </span>
          )}
          <button
            onClick={handleUpdate}
            disabled={updating}
            title={updateMsg ?? 'Aktualizovat data'}
            className="inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={13} className={updating ? 'animate-spin' : ''} />
            <span className="hidden md:inline">{updating ? 'Aktualizuji…' : 'Aktualizovat data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
