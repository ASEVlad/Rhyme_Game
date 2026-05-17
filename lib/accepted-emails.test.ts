import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  pool: { query: vi.fn() },
}));

// Imported after the mock so it picks up the stubbed pool.
import { pool } from '@/lib/db';
import { isEmailAccepted, upsertWaitlist } from './accepted-emails';

const mockQuery = (pool as unknown as { query: ReturnType<typeof vi.fn> }).query;

describe('isEmailAccepted', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns true when an accepted row exists', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [{}] });
    await expect(isEmailAccepted('alice@example.com')).resolves.toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('accepted=true'),
      ['alice@example.com'],
    );
  });

  it('returns false when no row matches (unknown or pending)', async () => {
    mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(isEmailAccepted('eve@example.com')).resolves.toBe(false);
  });

  it('returns false and logs when the query throws', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    await expect(isEmailAccepted('alice@example.com')).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('returns false without querying for null / undefined / empty input', async () => {
    await expect(isEmailAccepted('')).resolves.toBe(false);
    await expect(isEmailAccepted(null)).resolves.toBe(false);
    await expect(isEmailAccepted(undefined)).resolves.toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('upsertWaitlist', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns true and emits the upsert SQL when a fresh row is inserted', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ inserted: true }] });
    await expect(upsertWaitlist('alice@example.com', true)).resolves.toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (email) DO UPDATE SET accepted = EXCLUDED.accepted'),
      ['alice@example.com', true],
    );
  });

  it('returns false when the row already existed and was updated', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ inserted: false }] });
    await expect(upsertWaitlist('pending@example.com', false)).resolves.toBe(false);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ['pending@example.com', false],
    );
  });

  it('returns false for null / undefined / empty input without querying', async () => {
    await expect(upsertWaitlist('', true)).resolves.toBe(false);
    await expect(upsertWaitlist(null, true)).resolves.toBe(false);
    await expect(upsertWaitlist(undefined, false)).resolves.toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns false and logs via console.warn on error', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    await expect(upsertWaitlist('alice@example.com', true)).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
