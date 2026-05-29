import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '@/lib/db';
import { logGameRun, type GameRunRecord } from './game-runs';

const mockQuery = (pool as unknown as { query: ReturnType<typeof vi.fn> }).query;

const sample: GameRunRecord = {
  userEmail: 'tester@example.com',
  beat: { id: 'criminal', title: 'Criminal', bpm: 95, category: 'boom-bap', source: 'local' },
  language: 'en',
  difficulty: 'beginner',
  scheme: 'AABB',
  blockCount: 2,
  usedFallback: false,
  blocks: [{ words: ['day', 'way', 'play', 'say'] }],
};

describe('logGameRun', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('inserts a row with the run fields and serialized blocks', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
    await logGameRun(sample);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO game_runs');
    expect(params).toEqual([
      'tester@example.com',
      'criminal', 'Criminal', 95, 'boom-bap', 'local',
      'en', 'beginner', 'AABB',
      2, false,
      JSON.stringify(sample.blocks),
    ]);
  });

  it('stores nulls for a missing beat', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
    await logGameRun({ ...sample, beat: null });
    const params = mockQuery.mock.calls[0][1];
    expect(params.slice(1, 6)).toEqual([null, null, null, null, null]);
  });

  it('never throws and warns when the query fails', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    await expect(logGameRun(sample)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the pool is undefined', async () => {
    vi.resetModules();
    vi.doMock('@/lib/db', () => ({ pool: undefined }));
    const { logGameRun: logNoPool } = await import('./game-runs');
    await expect(logNoPool(sample)).resolves.toBeUndefined();
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });
});
