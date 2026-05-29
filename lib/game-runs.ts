import { pool } from '@/lib/db';
import type { RhymeBlock } from '@/lib/fallback-groups';

export type GameRunRecord = {
  userEmail: string | null;
  beat: {
    id: string | null;
    title: string | null;
    bpm: number | null;
    category: string | null;
    source: 'local' | 'youtube';
  } | null;
  language: string;
  difficulty: string;
  scheme: string;
  blockCount: number;
  usedFallback: boolean;
  blocks: RhymeBlock[];
};

export async function logGameRun(record: GameRunRecord): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO game_runs
         (user_email, beat_id, beat_title, beat_bpm, beat_category, beat_source,
          language, difficulty, scheme, block_count, used_fallback, blocks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        record.userEmail,
        record.beat?.id ?? null,
        record.beat?.title ?? null,
        record.beat?.bpm ?? null,
        record.beat?.category ?? null,
        record.beat?.source ?? null,
        record.language,
        record.difficulty,
        record.scheme,
        record.blockCount,
        record.usedFallback,
        JSON.stringify(record.blocks),
      ],
    );
  } catch (err) {
    console.warn('[game-runs] log failed:', err);
  }
}
