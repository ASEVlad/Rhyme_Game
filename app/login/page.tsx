import { Suspense } from 'react';
import { headers } from 'next/headers';
import { LoginContent } from './login-content';
import { ClosedBeta } from './closed-beta';

export default function LoginPage() {
  const inviteState = headers().get('x-rhyme-invite-state');
  if (inviteState === 'closed-beta') {
    return <ClosedBeta />;
  }
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
