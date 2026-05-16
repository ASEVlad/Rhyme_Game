import pg from 'pg';

export const pool = process.env.POSTGRES_URL
  ? new pg.Pool({ connectionString: process.env.POSTGRES_URL })
  : undefined;
