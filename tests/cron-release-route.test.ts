// tests/cron-release-route.test.ts
import { it, expect, vi, beforeEach, afterEach } from 'vitest';

const { releaseWaitlistBatch } = vi.hoisted(() => ({ releaseWaitlistBatch: vi.fn() }));
vi.mock('@/lib/release-waitlist', () => ({ releaseWaitlistBatch }));
vi.mock('@/lib/db', () => ({ pool: {} }));

import { POST } from '@/app/api/cron/release-waitlist/route';

const post = (headers: Record<string, string> = {}) =>
  POST(new Request('http://localhost/api/cron/release-waitlist', { method: 'POST', headers }));

beforeEach(() => {
  releaseWaitlistBatch.mockReset();
  releaseWaitlistBatch.mockResolvedValue({ accepted: ['a@b.com'], failed: [], remaining: 7 });
  vi.stubEnv('CRON_SECRET', 'topsecret');
  vi.stubEnv('WAITLIST_DAILY_BATCH', '20');
  vi.stubEnv('REGISTRATION_OPEN', '');
});
afterEach(() => vi.unstubAllEnvs());

it('401s without a bearer header and never runs the batch', async () => {
  const res = await post();
  expect(res.status).toBe(401);
  expect(releaseWaitlistBatch).not.toHaveBeenCalled();
});

it('401s on a wrong bearer token', async () => {
  const res = await post({ authorization: 'Bearer nope' });
  expect(res.status).toBe(401);
});

it('401s when CRON_SECRET is unset (fail closed)', async () => {
  vi.stubEnv('CRON_SECRET', '');
  const res = await post({ authorization: 'Bearer topsecret' });
  expect(res.status).toBe(401);
});

it('accepts a batch of WAITLIST_DAILY_BATCH when registration is closed', async () => {
  const res = await post({ authorization: 'Bearer topsecret' });
  expect(res.status).toBe(200);
  expect(releaseWaitlistBatch).toHaveBeenCalledWith(20);
  expect(await res.json()).toEqual({ accepted: 1, failed: 0, remaining: 7 });
});

it('drains everything when REGISTRATION_OPEN=true', async () => {
  vi.stubEnv('REGISTRATION_OPEN', 'true');
  await post({ authorization: 'Bearer topsecret' });
  expect(releaseWaitlistBatch).toHaveBeenCalledWith(Number.MAX_SAFE_INTEGER);
});

it('503s when the pool is undefined (after auth passes)', async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({ pool: undefined }));
  vi.doMock('@/lib/release-waitlist', () => ({ releaseWaitlistBatch }));
  const { POST: POST503 } = await import('@/app/api/cron/release-waitlist/route');
  const res = await POST503(
    new Request('http://localhost/api/cron/release-waitlist', {
      method: 'POST',
      headers: { authorization: 'Bearer topsecret' },
    }),
  );
  expect(res.status).toBe(503);
  expect(releaseWaitlistBatch).not.toHaveBeenCalled();
  vi.doUnmock('@/lib/db');
  vi.doUnmock('@/lib/release-waitlist');
  vi.resetModules();
});

it('500s when the release batch throws', async () => {
  releaseWaitlistBatch.mockRejectedValueOnce(new Error('db boom'));
  const res = await post({ authorization: 'Bearer topsecret' });
  expect(res.status).toBe(500);
});
