import { Suspense } from 'react';
import { LoginContent } from './login-content';

// LoginContent uses useSearchParams() to read ?error=...; the page also
// inspects the invite cookie at sign-in time. Force dynamic to opt out of
// static prerender — otherwise the shell gets cached for s-maxage=1y.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
