import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendAcceptedEmail } from '@/lib/accept-notify';

describe('sendAcceptedEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('AUTH_RESEND_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'noreply@rhymefor.fun');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://rhymefor.fun');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false and does not call fetch when the key is missing', async () => {
    vi.stubEnv('AUTH_RESEND_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendAcceptedEmail('a@b.com')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns true when Resend responds ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendAcceptedEmail('a@b.com')).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(init.body);
    expect(body.to).toBe('a@b.com');
    expect(body.text).toContain('https://rhymefor.fun/login');
  });

  it('returns false when Resend responds non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('rate limited'),
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendAcceptedEmail('a@b.com')).toBe(false);
  });
});
