import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Resend from 'next-auth/providers/resend';
import PostgresAdapter from '@auth/pg-adapter';
import { authConfig } from './auth.config';
import { pool } from './lib/db';
import { isEmailAccepted, upsertWaitlist } from './lib/accepted-emails';
import { isInviteCookieValid } from './lib/invite';
import { notifyWaitlistJoin } from './lib/waitlist-notify';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

async function decideSignIn(email: string): Promise<boolean> {
  if (isInviteCookieValid()) {
    const inserted = await upsertWaitlist(email, true);
    if (inserted) await notifyWaitlistJoin(email);
    return true;
  }
  if (await isEmailAccepted(email)) {
    return true;
  }
  const inserted = await upsertWaitlist(email, false);
  if (inserted) await notifyWaitlistJoin(email);
  return false;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  ...(pool ? { adapter: PostgresAdapter(pool) } : {}),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: { email: { type: 'email' } },
      async authorize(credentials) {
        const email = credentials?.email;
        if (typeof email !== 'string') return null;
        if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return null;
        if (!(await decideSignIn(email))) return null;
        return { id: email, email, name: null };
      },
    }),
    Resend({ from: process.env.EMAIL_FROM ?? '' }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true;
      if (account?.provider === 'google') {
        const email = user.email;
        if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return false;
        return decideSignIn(email);
      }
      // Any other provider (including the registered-but-unused 'resend') is denied.
      return false;
    },
  },
});
