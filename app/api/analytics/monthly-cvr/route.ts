import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

const client = new BetaAnalyticsDataClient({
  credentials: {
    client_email: process.env.GA4_CLIENT_EMAIL,
    private_key: process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// GA4 device filter — 'all' means no filter at all
const DEVICES = ['desktop', 'mobile', 'tablet'] as const;
type Device = typeof DEVICES[number] | 'all';

function deviceFilter(device: Device) {
  if (device === 'all') return undefined;
  return {
    filter: {
      fieldName: 'deviceCategory',
      stringFilter: { value: device, matchType: 'EXACT' as const },
    },
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get('year') ?? new Date().getFullYear());
  const propertyId = process.env.GA4_PROPERTY_ID;
  const rawDevice = searchParams.get('device');
  const device: Device = (DEVICES as readonly string[]).includes(rawDevice ?? '')
    ? (rawDevice as Device)
    : 'all';

  const currStart = `${year}-01-01`;
  const currEnd = `${year}-12-31`;
  const prevStart = `${year - 1}-01-01`;
  const prevEnd = `${year - 1}-12-31`;

  try {
    const [[currRes], [prevRes]] = await Promise.all([
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: currStart, endDate: currEnd }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'conversions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        dimensionFilter: deviceFilter(device),
      }),
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: prevStart, endDate: prevEnd }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'conversions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        dimensionFilter: deviceFilter(device),
      }),
    ]);

    const parseRows = (res: typeof currRes) =>
      res.rows?.map(row => ({
        date: row.dimensionValues?.[0].value ?? '',
        sessions: Number(row.metricValues?.[0].value ?? 0),
        conversions: Number(row.metricValues?.[1].value ?? 0),
      })) ?? [];

    return NextResponse.json({
      daily: parseRows(currRes),
      dailyPrev: parseRows(prevRes),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'GA4 error';
    console.error('[monthly-cvr]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
