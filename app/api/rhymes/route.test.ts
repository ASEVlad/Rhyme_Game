import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'tester@example.com' } })),
}));
vi.mock('@/lib/game-runs', () => ({ logGameRun: vi.fn(async () => {}) }));
vi.mock('@/lib/rhymes', () => ({
  fetchRhymeBlocks: vi.fn(async () => ({
    blocks: [{ words: ['a', 'b', 'c', 'd'] }],
    usedFallback: false,
  })),
}));

import { POST } from './route';
import { logGameRun } from '@/lib/game-runs';

const mockLog = logGameRun as unknown as ReturnType<typeof vi.fn>;

function postReq(body: unknown) {
  return new Request('http://localhost/api/rhymes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/rhymes logging', () => {
  beforeEach(() => {
    mockLog.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('logs the run with email, options, and beat (source defaults to local)', async () => {
    const res = await POST(postReq({
      language: 'en',
      difficultyId: 'beginner',
      schemeId: 'AABB',
      beat: { id: 'criminal', title: 'Criminal', bpm: 95, category: 'boom-bap' },
    }));
    expect(res.status).toBe(200);
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({
      userEmail: 'tester@example.com',
      language: 'en',
      difficulty: 'beginner',
      scheme: 'AABB',
      usedFallback: false,
      blockCount: 1,
      beat: expect.objectContaining({ id: 'criminal', source: 'local' }),
    }));
  });

  it('logs beat=null when no beat is provided', async () => {
    await POST(postReq({ language: 'en' }));
    expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({ beat: null }));
  });
});
