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
