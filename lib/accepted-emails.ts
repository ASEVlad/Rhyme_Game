import { pool } from '@/lib/db';

export async function isEmailAccepted(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  if (!pool) return false;
  try {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM waitlist WHERE email=$1 AND accepted=true LIMIT 1',
      [email],
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    console.warn('[accepted-emails] query failed:', err);
    return false;
  }
}

/**
 * Upsert a waitlist row. Returns true iff a brand-new row was inserted
 * (the email was not previously in the waitlist at all).
 *
 * Uses Postgres' xmax trick: a freshly-inserted row has xmax = 0; a row
 * touched by ON CONFLICT DO UPDATE has xmax = the updating xid.
 */
export async function upsertWaitlist(
  email: string | null | undefined,
  accepted: boolean,
): Promise<boolean> {
  if (!email) return false;
  if (!pool) return false;
  try {
    const { rows } = await pool.query<{ inserted: boolean }>(
      `INSERT INTO waitlist (email, accepted) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET accepted = EXCLUDED.accepted
       RETURNING (xmax = 0) AS inserted`,
      [email, accepted],
    );
    return rows[0]?.inserted === true;
  } catch (err) {
    console.warn('[accepted-emails] upsert failed:', err);
    return false;
  }
}
