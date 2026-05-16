import NextAuth from 'next-auth';
import PostgresAdapter from '@auth/pg-adapter';
import { authConfig } from './auth.config';
import { pool } from './lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  ...(pool ? { adapter: PostgresAdapter(pool) } : {}),
});
