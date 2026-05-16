import { Suspense } from 'react';
import { headers } from 'next/headers';
import { INVITE_STATE_HEADER, INVITE_STATE_CLOSED_BETA } from '@/lib/invite';
import { LoginContent } from './login-content';
import { ClosedBeta } from './closed-beta';

export default function LoginPage() {
  const inviteState = headers().get(INVITE_STATE_HEADER);
  if (inviteState === INVITE_STATE_CLOSED_BETA) {
    return <ClosedBeta />;
  }

  const emailEnabled = !!(
    process.env.POSTGRES_URL &&
    process.env.AUTH_RESEND_KEY &&
    process.env.EMAIL_FROM
  );

  return (
    <Suspense>
      <LoginContent emailEnabled={emailEnabled} />
    </Suspense>
  );
}
