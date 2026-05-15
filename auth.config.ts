import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';

export function isEmailAllowed(email: string | null | undefined): boolean {
  const list = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
  return list.includes(email ?? '');
}

export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = ['/play', '/yt', '/calibrate'].some(p =>
        nextUrl.pathname.startsWith(p)
      );
      if (isProtected && !isLoggedIn) return false;
      if (nextUrl.pathname === '/login' && isLoggedIn) {
        return Response.redirect(new URL('/play', nextUrl));
      }
      return true;
    },
    signIn({ user }) {
      return isEmailAllowed(user.email);
    },
  },
  providers: [
    Google,
    Resend({ from: process.env.EMAIL_FROM ?? '' }),
  ],
} satisfies NextAuthConfig;
