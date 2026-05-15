import NextAuth from 'next-auth';
import PostgresAdapter from '@auth/pg-adapter';
import pg from 'pg';
import { authConfig } from './auth.config';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PostgresAdapter(pool),
});
