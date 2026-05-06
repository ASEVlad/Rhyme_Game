import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { signCookie, COOKIE_NAME, COOKIE_MAX_AGE_S } from '@/lib/auth';

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!expected || !secret) {
    return NextResponse.json({ error: 'server-misconfigured' }, { status: 500 });
  }
  if (typeof password !== 'string' || !safeEq(password, expected)) {
    return NextResponse.json({ error: 'invalid-password' }, { status: 401 });
  }
  const cookie = signCookie({ exp: Date.now() + COOKIE_MAX_AGE_S * 1000 }, secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_S,
    path: '/',
  });
  return res;
}
