import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.META_ACCESS_TOKEN!;
const RAW_ID = process.env.META_AD_ACCOUNT_ID ?? '';
const ACCOUNT_ID = RAW_ID.startsWith('act_') ? RAW_ID : `act_${RAW_ID}`;

type ActionArray = { action_type: string; value: string }[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function shiftYearBack(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().split('T')[0];
}

function findAction(arr: ActionArray | undefined, type: string): number {
  return Number(arr?.find(a => a.action_type === type)?.value ?? 0);
}

function findActionValue(arr: ActionArray | undefined): number {
  const omni = arr?.find(a => a.action_type === 'omni_purchase');
  if (omni) return Number(omni.value);
  return Number(arr?.find(a => a.action_type === 'purchase')?.value ?? 0);
}

function parseRoas(arr: ActionArray | undefined): number {
  if (!arr || arr.length === 0) return 0;
  return Number(arr[0].value);
}

function parseRow(row: AnyRow) {
  const purchases = findAction(row?.actions, 'purchase') || findAction(row?.actions, 'omni_purchase');
  const spend = Number(row?.spend ?? 0);
  return {
    spend,
    reach:       Number(row?.reach ?? 0),
    impressions: Number(row?.impressions ?? 0),
    clicks:      Number(row?.clicks ?? 0),
    ctr:         Number(row?.ctr ?? 0),
    cpc:         Number(row?.cpc ?? 0),
    purchases,
    addToCart:   findAction(row?.actions, 'add_to_cart'),
    revenue:     findActionValue(row?.action_values),
    roas:        parseRoas(row?.purchase_roas),
    cpa:         purchases > 0 ? spend / purchases : 0,
  };
}

/** Vrátí prefix filtru pro název kampaně, nebo null (= vše) */
function campaignPrefix(country: string): string | null {
  if (country === 'cz') return 'CZ-';
  if (country === 'sk') return 'SK-';
  return null;
}

function sumRows(rows: AnyRow[]) {
  const base = { spend: 0, reach: 0, impressions: 0, clicks: 0, purchases: 0, addToCart: 0, revenue: 0 };
  for (const r of rows) {
    const p = parseRow(r);
    base.spend       += p.spend;
    base.reach       += p.reach;
    base.impressions += p.impressions;
    base.clicks      += p.clicks;
    base.purchases   += p.purchases;
    base.addToCart   += p.addToCart;
    base.revenue     += p.revenue;
  }
  const ctr = base.impressions > 0 ? (base.clicks / base.impressions) * 100 : 0;
  const cpc = base.clicks      > 0 ? base.spend / base.clicks            : 0;
  const roas= base.revenue     > 0 ? base.revenue / base.spend           : 0;
  const cpa = base.purchases   > 0 ? base.spend / base.purchases         : 0;
  return { ...base, ctr, cpc, roas, cpa };
}

async function callInsights(params: Record<string, string>): Promise<AnyRow> {
  const p = new URLSearchParams({ ...params, access_token: TOKEN });
  const url = `${BASE}/${ACCOUNT_ID}/insights?${p.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta insights error: ${text}`);
  }
  return res.json();
}

/** Stáhne všechny stránky (cursor pagination) */
async function fetchAllPages(params: Record<string, string>): Promise<AnyRow[]> {
  const rows: AnyRow[] = [];
  let json = await callInsights({ ...params, limit: '500' });
  rows.push(...(json.data ?? []));
  while (json.paging?.next) {
    const res = await fetch(json.paging.next, { cache: 'no-store' });
    json = await res.json();
    rows.push(...(json.data ?? []));
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const from    = sp.get('from') ?? new Date().toISOString().split('T')[0];
  const to      = sp.get('to')   ?? new Date().toISOString().split('T')[0];
  const country = sp.get('country') ?? 'all';

  const prevFrom = shiftYearBack(from);
  const prevTo   = shiftYearBack(to);
  const prefix   = campaignPrefix(country);

  const FIELDS = 'spend,reach,impressions,clicks,ctr,cpc,actions,action_values,purchase_roas,campaign_name';
  const AD_FIELDS = `${FIELDS},ad_id,ad_name,adset_name`;

  try {
    // Paralelně stáhneme: campaign-level aktuální, campaign-level předchozí rok, denní campaign, ad-level
    const [campRows, campPrevRows, campDailyRows, adRows] = await Promise.all([
      fetchAllPages({ fields: FIELDS,    time_range: JSON.stringify({ since: from,     until: to     }), level: 'campaign' }),
      fetchAllPages({ fields: FIELDS,    time_range: JSON.stringify({ since: prevFrom, until: prevTo }), level: 'campaign' }),
      fetchAllPages({ fields: FIELDS,    time_range: JSON.stringify({ since: from,     until: to     }), level: 'campaign', time_increment: '1' }),
      fetchAllPages({ fields: AD_FIELDS, time_range: JSON.stringify({ since: from,     until: to     }), level: 'ad',       sort: 'spend_descending' }),
    ]);

    // Filtrování dle prefixu kampaně (client-side)
    const filter = (rows: AnyRow[]) =>
      prefix ? rows.filter((r: AnyRow) => (r.campaign_name as string)?.startsWith(prefix)) : rows;

    const filteredCamp     = filter(campRows);
    const filteredCampPrev = filter(campPrevRows);
    const filteredAdRows   = filter(adRows);

    // KPI agregáty
    const kpi     = sumRows(filteredCamp);
    const kpiPrev = sumRows(filteredCampPrev);

    // Denní data — seskupit dle date_start, filtrovat, agregovat
    const dailyMap: Record<string, AnyRow[]> = {};
    for (const r of filter(campDailyRows)) {
      const d = r.date_start as string;
      if (!dailyMap[d]) dailyMap[d] = [];
      dailyMap[d].push(r);
    }
    const daily = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => ({ date, ...sumRows(rows) }));

    // Thumbnaily + statusy pro reklamy
    const adIds: string[] = [...new Set(filteredAdRows.map((r: AnyRow) => r.ad_id).filter(Boolean))];
    const metaMap: Record<string, { thumbnailUrl: string | null; status: string }> = {};

    if (adIds.length > 0) {
      const batchUrl = `${BASE}/?ids=${adIds.slice(0, 100).join(',')}&fields=effective_status,creative{thumbnail_url}&access_token=${TOKEN}`;
      const batchRes = await fetch(batchUrl, { cache: 'no-store' });
      if (batchRes.ok) {
        const batchJson = await batchRes.json();
        for (const [id, obj] of Object.entries(batchJson) as [string, AnyRow][]) {
          metaMap[id] = {
            thumbnailUrl: obj?.creative?.thumbnail_url ?? null,
            status:       obj?.effective_status ?? 'UNKNOWN',
          };
        }
      }
    }

    const ads = filteredAdRows.map((row: AnyRow) => {
      const p    = parseRow(row);
      const meta = metaMap[row.ad_id] ?? { thumbnailUrl: null, status: 'UNKNOWN' };
      return {
        adId:         row.ad_id,
        adName:       row.ad_name,
        campaignName: row.campaign_name,
        adsetName:    row.adset_name,
        thumbnailUrl: meta.thumbnailUrl,
        status:       meta.status,
        ...p,
      };
    });

    return NextResponse.json({ kpi, kpiPrev, daily, ads });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Meta API]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
