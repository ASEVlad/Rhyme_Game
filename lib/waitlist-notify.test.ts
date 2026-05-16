import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notifyWaitlistJoin } from './waitlist-notify';

const originalEnv = process.env;

describe('notifyWaitlistJoin', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('posts to Resend when all env vars are set', async () => {
    process.env.AUTH_RESEND_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'noreply@rhyme.game';
    process.env.WAITLIST_NOTIFY_EMAIL = 'owner@rhyme.game';

    await notifyWaitlistJoin('joiner@example.com');

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer re_test_key',
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('noreply@rhyme.game');
    expect(body.to).toBe('owner@rhyme.game');
    expect(body.subject).toBe('New Rhyme Game waitlist signup');
    expect(body.text).toContain('joiner@example.com');
  });

  it('no-ops when WAITLIST_NOTIFY_EMAIL is unset', async () => {
    process.env.AUTH_RESEND_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'noreply@rhyme.game';
    delete process.env.WAITLIST_NOTIFY_EMAIL;

    await notifyWaitlistJoin('joiner@example.com');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('no-ops when AUTH_RESEND_KEY is unset', async () => {
    delete process.env.AUTH_RESEND_KEY;
    process.env.EMAIL_FROM = 'noreply@rhyme.game';
    process.env.WAITLIST_NOTIFY_EMAIL = 'owner@rhyme.game';

    await notifyWaitlistJoin('joiner@example.com');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('swallows fetch rejections without throwing', async () => {
    process.env.AUTH_RESEND_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'noreply@rhyme.game';
    process.env.WAITLIST_NOTIFY_EMAIL = 'owner@rhyme.game';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(notifyWaitlistJoin('joiner@example.com')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('logs a warning when Resend returns a non-ok response', async () => {
    process.env.AUTH_RESEND_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'noreply@rhyme.game';
    process.env.WAITLIST_NOTIFY_EMAIL = 'owner@rhyme.game';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await notifyWaitlistJoin('joiner@example.com');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
