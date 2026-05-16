import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { notifyWaitlistJoin } from '@/lib/waitlist-notify';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export async function POST(request: Request) {
  let email: unknown = null;
  try {
    const body = await request.json();
    email = body?.email;
  } catch {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  if (!pool) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  try {
    const { rowCount } = await pool.query(
      'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING id',
      [email],
    );
    if (rowCount && rowCount > 0) {
      await notifyWaitlistJoin(email);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('[waitlist] insert failed:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
