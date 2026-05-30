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

  // Stay under Resend's 5 req/sec ceiling: 250ms between sends gives margin.
  const SEND_GAP_MS = 250;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, SEND_GAP_MS));
    const { email } = rows[i];
    const sent = await sendAcceptedEmail(email);
    if (!sent) {
      failed.push(email);
      continue;
    }
    try {
      await pool.query(`UPDATE waitlist SET accepted = true WHERE email = $1`, [email]);
      accepted.push(email);
    } catch (err) {
      console.warn('[release-waitlist] UPDATE failed after email sent:', email, err);
      failed.push(email);
    }
  }

  const { rows: countRows } = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM waitlist WHERE accepted = false`,
  );
  const remaining = Number(countRows[0]?.count ?? 0);

  return { accepted, failed, remaining };
}
