import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { releaseWaitlistBatch } from '@/lib/release-waitlist';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!pool) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const open = process.env.REGISTRATION_OPEN === 'true';
  const limit = open
    ? Number.MAX_SAFE_INTEGER
    : Number.parseInt(process.env.WAITLIST_DAILY_BATCH ?? '20', 10) || 20;

  try {
    const { accepted, failed, remaining } = await releaseWaitlistBatch(limit);
    return NextResponse.json({
      accepted: accepted.length,
      failed: failed.length,
      remaining,
    });
  } catch (err) {
    console.warn('[cron/release-waitlist] release failed:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
