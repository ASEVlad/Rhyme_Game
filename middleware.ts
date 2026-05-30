import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ['/play', '/yt', '/calibrate', '/admin'];

export default auth(req => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const path = nextUrl.pathname;

  if (PROTECTED_PREFIXES.some(p => path.startsWith(p)) && !isLoggedIn && !process.env.SCREENSHOT_BYPASS) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  if (path === '/login' && isLoggedIn) {
    return NextResponse.redirect(new URL('/play', nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|beats).*)'],
};
