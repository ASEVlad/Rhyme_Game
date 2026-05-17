import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  pool: { query: vi.fn() },
}));

// Imported after the mock so it picks up the stubbed pool.
import { pool } from '@/lib/db';
import { isEmailAccepted } from './accepted-emails';

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
