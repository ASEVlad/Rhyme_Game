import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';
import { decideInvite } from './lib/invite';

const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ['/play', '/yt', '/calibrate'];

export default auth(req => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const path = nextUrl.pathname;

  // Protected routes require auth
  if (PROTECTED_PREFIXES.some(p => path.startsWith(p)) && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // /login routing
  if (path === '/login') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/play', nextUrl));
    }

    const decision = decideInvite({
      envCode: process.env.INVITE_CODE,
      queryCode: nextUrl.searchParams.get('invite') ?? undefined,
    });

    if (decision.kind === 'set') {
      const cleanUrl = new URL('/login', nextUrl);
      const res = NextResponse.redirect(cleanUrl, 307);
      res.cookies.set('rhyme-invite', decision.code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 90 * 24 * 60 * 60,
      });
      return res;
    }

    // decision.kind === 'pass': fall through, render the login form normally.
  }

  // All other routes: pass through
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|beats).*)'],
};
