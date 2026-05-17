import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import PostgresAdapter from '@auth/pg-adapter';
import { authConfig } from './auth.config';
import { pool } from './lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  ...(pool ? { adapter: PostgresAdapter(pool) } : {}),
  providers: [
    ...authConfig.providers,
    Resend({ from: process.env.EMAIL_FROM ?? '' }),
  ],
});
