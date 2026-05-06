import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (pathname.startsWith('/_next') || pathname.startsWith('/beats') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!secret || !cookie) {
    return redirectToLogin(req);
  }
  const result = await verifyCookie(cookie, secret);
  if (!result.valid) {
    const res = redirectToLogin(req);
    res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
    return res;
  }
  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
