import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Resend from 'next-auth/providers/resend';
import PostgresAdapter from '@auth/pg-adapter';
import { authConfig } from './auth.config';
import { pool } from './lib/db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
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
        if (!isValidEmail(email)) return null;
        return { id: email, email, name: null };
      },
    }),
    Resend({ from: process.env.EMAIL_FROM ?? '' }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true;
      if (account?.provider === 'google') return isValidEmail(user.email);
      // Any other provider (including the registered-but-unused 'resend') is denied.
      return false;
    },
  },
});
