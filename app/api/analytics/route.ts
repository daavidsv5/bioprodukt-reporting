import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

const client = new BetaAnalyticsDataClient({
  credentials: {
    client_email: process.env.GA4_CLIENT_EMAIL,
    private_key: process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

function shiftYearBack(dateStr: string): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('from') ?? '30daysAgo';
  const endDate   = searchParams.get('to')   ?? 'today';

  const prevStart = shiftYearBack(startDate);
  const prevEnd   = shiftYearBack(endDate);

  try {
    // Daily sessions + users + conversions (current period only)
    const [dailyRes] = await client.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'conversions' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    // Aggregate totals: current + previous year in one request (two dateRanges, no dimensions)
    const [aggRes] = await client.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [
        { startDate, endDate,   name: 'current'  },
        { startDate: prevStart, endDate: prevEnd, name: 'previous' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'conversions' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
    });

    // Traffic by source/medium
    const [sourceRes] = await client.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'conversions' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20,
    });

    // Device category
    const [deviceRes] = await client.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    });

    const daily = dailyRes.rows?.map(row => ({
      date:        row.dimensionValues?.[0].value ?? '',
      sessions:    Number(row.metricValues?.[0].value ?? 0),
      users:       Number(row.metricValues?.[1].value ?? 0),
      conversions: Number(row.metricValues?.[2].value ?? 0),
      bounceRate:  Math.round(Number(row.metricValues?.[3].value ?? 0) * 100),
      avgDuration: Math.round(Number(row.metricValues?.[4].value ?? 0)),
    })) ?? [];

    // Parse aggregate rows — GA4 returns one row per dateRange when no dimensions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseAgg = (row: any) => {
      if (!row) return { sessions: 0, users: 0, conversions: 0, bounceRate: 0, avgDuration: 0 };
      return {
        sessions:    Number(row.metricValues?.[0]?.value ?? 0),
        users:       Number(row.metricValues?.[1]?.value ?? 0),
        conversions: Number(row.metricValues?.[2]?.value ?? 0),
        bounceRate:  Math.round(Number(row.metricValues?.[3]?.value ?? 0) * 100),
        avgDuration: Math.round(Number(row.metricValues?.[4]?.value ?? 0)),
      };
    };

    const rows = aggRes.rows ?? [];
    const totals = {
      current:  parseAgg(rows[0]),
      previous: parseAgg(rows[1]),
    };

    const sources = sourceRes.rows?.map(row => ({
      source:      row.dimensionValues?.[0].value ?? '',
      medium:      row.dimensionValues?.[1].value ?? '',
      sessions:    Number(row.metricValues?.[0].value ?? 0),
      conversions: Number(row.metricValues?.[1].value ?? 0),
      users:       Number(row.metricValues?.[2].value ?? 0),
    })) ?? [];

    const devices = deviceRes.rows?.map(row => ({
      device:   row.dimensionValues?.[0].value ?? '',
      sessions: Number(row.metricValues?.[0].value ?? 0),
      users:    Number(row.metricValues?.[1].value ?? 0),
    })) ?? [];

    return NextResponse.json({ daily, totals, sources, devices });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'GA4 error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
