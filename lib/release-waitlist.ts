// lib/release-waitlist.ts
import { pool } from '@/lib/db';
import { sendAcceptedEmail } from '@/lib/accept-notify';

export interface ReleaseResult {
  accepted: string[];
  failed: string[];
  remaining: number;
}

export async function releaseWaitlistBatch(limit: number): Promise<ReleaseResult> {
  const accepted: string[] = [];
  const failed: string[] = [];
  if (!pool) return { accepted, failed, remaining: 0 };

  const { rows } = await pool.query<{ email: string }>(
    `SELECT email FROM waitlist
     WHERE accepted = false
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );

  for (const { email } of rows) {
    const sent = await sendAcceptedEmail(email);
    if (!sent) {
      failed.push(email);
      continue;
    }
    await pool.query(`UPDATE waitlist SET accepted = true WHERE email = $1`, [email]);
    accepted.push(email);
  }

  const { rows: countRows } = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM waitlist WHERE accepted = false`,
  );
  const remaining = Number(countRows[0]?.count ?? 0);

  return { accepted, failed, remaining };
}
