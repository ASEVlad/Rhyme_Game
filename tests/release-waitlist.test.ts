// tests/release-waitlist.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { query, sendAcceptedEmail } = vi.hoisted(() => ({
  query: vi.fn(),
  sendAcceptedEmail: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ pool: { query } }));
vi.mock('@/lib/accept-notify', () => ({ sendAcceptedEmail }));

import { releaseWaitlistBatch } from '@/lib/release-waitlist';

beforeEach(() => {
  query.mockReset();
  sendAcceptedEmail.mockReset();
});

it('selects oldest-first up to the limit', async () => {
  query
    .mockResolvedValueOnce({ rows: [] }) // SELECT (empty)
    .mockResolvedValueOnce({ rows: [{ count: 0 }] }); // remaining count
  await releaseWaitlistBatch(5);
  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain('accepted = false');
  expect(sql).toContain('ORDER BY created_at ASC');
  expect(params).toEqual([5]);
});

it('emails then flips accepted only on send success', async () => {
  query
    .mockResolvedValueOnce({ rows: [{ email: 'a@b.com' }, { email: 'c@d.com' }] }) // SELECT
    .mockResolvedValueOnce({ rows: [] }) // UPDATE a
    .mockResolvedValueOnce({ rows: [] }) // UPDATE c
    .mockResolvedValueOnce({ rows: [{ count: 3 }] }); // remaining
  sendAcceptedEmail.mockResolvedValue(true);

  const result = await releaseWaitlistBatch(10);

  expect(result.accepted).toEqual(['a@b.com', 'c@d.com']);
  expect(result.failed).toEqual([]);
  expect(result.remaining).toBe(3);
  // 1 SELECT + 2 UPDATE + 1 count = 4 queries
  expect(query).toHaveBeenCalledTimes(4);
  expect(query.mock.calls[1][0]).toContain('UPDATE waitlist SET accepted = true');
  expect(query.mock.calls[1][1]).toEqual(['a@b.com']);
});

it('leaves a row pending (no UPDATE) when its email fails', async () => {
  query
    .mockResolvedValueOnce({ rows: [{ email: 'good@b.com' }, { email: 'bad@b.com' }] }) // SELECT
    .mockResolvedValueOnce({ rows: [] }) // UPDATE good
    .mockResolvedValueOnce({ rows: [{ count: 1 }] }); // remaining
  sendAcceptedEmail.mockImplementation((e: string) => Promise.resolve(e === 'good@b.com'));

  const result = await releaseWaitlistBatch(10);

  expect(result.accepted).toEqual(['good@b.com']);
  expect(result.failed).toEqual(['bad@b.com']);
  // Only ONE UPDATE happened (for good@b.com), so 1 SELECT + 1 UPDATE + 1 count = 3
  expect(query).toHaveBeenCalledTimes(3);
});

it('returns empty when the pool is undefined', async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({ pool: undefined }));
  const mod = await import('@/lib/release-waitlist');
  expect(await mod.releaseWaitlistBatch(10)).toEqual({
    accepted: [],
    failed: [],
    remaining: 0,
  });
  vi.doUnmock('@/lib/db');
  vi.resetModules();
});

it('treats an UPDATE failure (after a sent email) as a failed row, not a throw', async () => {
  query
    .mockResolvedValueOnce({ rows: [{ email: 'a@b.com' }] }) // SELECT
    .mockRejectedValueOnce(new Error('db down')) // UPDATE rejects
    .mockResolvedValueOnce({ rows: [{ count: 1 }] }); // remaining count
  sendAcceptedEmail.mockResolvedValue(true);

  const result = await releaseWaitlistBatch(10);

  expect(result.accepted).toEqual([]);
  expect(result.failed).toEqual(['a@b.com']);
  expect(result.remaining).toBe(1);
});
