import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RunRow = {
  id: string;
  user_email: string | null;
  beat_title: string | null;
  beat_source: string | null;
  beat_bpm: number | null;
  language: string;
  difficulty: string;
  scheme: string;
  used_fallback: boolean | null;
  blocks: { words: string[] }[];
  created_at: string;
};

async function recentRuns(): Promise<RunRow[]> {
  if (!pool) return [];
  try {
    const { rows } = await pool.query<RunRow>(
      `SELECT id, user_email, beat_title, beat_source, beat_bpm,
              language, difficulty, scheme, used_fallback, blocks, created_at
         FROM game_runs
         ORDER BY created_at DESC
         LIMIT 100`,
    );
    return rows;
  } catch {
    return [];
  }
}

function summarizeBlocks(blocks: { words: string[] }[]): string {
  return blocks
    .map(b => (b?.words ?? []).filter(Boolean).join(' / '))
    .join('  |  ');
}

export default async function AdminRunsPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) redirect('/login');

  const runs = await recentRuns();

  return (
    <main className="min-h-screen bg-[#060c14] text-white/90 p-6">
      <h1 className="text-xl mb-4">Game runs (latest {runs.length})</h1>
      {runs.length === 0 ? (
        <p className="text-white/50">No runs recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-white/50 border-b border-white/10">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Beat</th>
                <th className="py-2 pr-4">Lang</th>
                <th className="py-2 pr-4">Diff</th>
                <th className="py-2 pr-4">Scheme</th>
                <th className="py-2 pr-4">Fallback</th>
                <th className="py-2 pr-4">Rhymes</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id} className="border-b border-white/5 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{r.user_email ?? '—'}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {r.beat_title ?? '—'}
                    {r.beat_source ? ` (${r.beat_source})` : ''}
                    {r.beat_bpm != null ? ` · ${r.beat_bpm} BPM` : ''}
                  </td>
                  <td className="py-2 pr-4">{r.language}</td>
                  <td className="py-2 pr-4">{r.difficulty}</td>
                  <td className="py-2 pr-4">{r.scheme}</td>
                  <td className="py-2 pr-4">{r.used_fallback ? 'yes' : 'no'}</td>
                  <td className="py-2 pr-4 text-white/70">{summarizeBlocks(r.blocks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
