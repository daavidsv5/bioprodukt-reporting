import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ limited: false, retryAfterMs: 0 });

  const { limited, retryAfterMs } = await isRateLimited(email);
  return NextResponse.json({ limited, retryAfterMs });
}
