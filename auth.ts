import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Resend from 'next-auth/providers/resend';
import PostgresAdapter from '@auth/pg-adapter';
import { authConfig } from './auth.config';
import { pool } from './lib/db';
import { isEmailAccepted } from './lib/accepted-emails';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

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
        if (!(await isEmailAccepted(email))) return null;
        return { id: email, email, name: null };
      },
    }),
    Resend({ from: process.env.EMAIL_FROM ?? '' }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true;
      if (account?.provider === 'google') return isEmailAccepted(user.email);
      // Any other provider (including the registered-but-unused 'resend') is denied.
      return false;
    },
  },
});
