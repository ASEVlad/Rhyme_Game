// lib/decide-signin.ts
import { isEmailAccepted, upsertWaitlist } from '@/lib/accepted-emails';
import { isInviteCookieValid } from '@/lib/invite';
import { notifyWaitlistJoin } from '@/lib/waitlist-notify';

export async function decideSignIn(email: string): Promise<boolean> {
  if (process.env.REGISTRATION_OPEN === 'true') {
    await upsertWaitlist(email, true);
    return true;
  }
  if (isInviteCookieValid()) {
    const inserted = await upsertWaitlist(email, true);
    if (inserted) await notifyWaitlistJoin(email);
    return true;
  }
  if (await isEmailAccepted(email)) {
    return true;
  }
  const inserted = await upsertWaitlist(email, false);
  if (inserted) await notifyWaitlistJoin(email);
  return false;
}
