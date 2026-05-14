'use client';

import { useEffect, useRef, useState } from 'react';
import type { BeatCategory } from '@/lib/beats';

const CATEGORIES: BeatCategory[] = ['boom-bap', 'trap', 'jazz', 'lo-fi', 'drill', 'other'];

export default function CalibratePage() {
  const [path, setPath] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bpm, setBpm] = useState<number | null>(null);
  const [category, setCategory] = useState<BeatCategory>('other');
  const [startOffset, setStartOffset] = useState(0);
  const [taps, setTaps] = useState<number[]>([]);
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  async function handleLoad() {
    if (!path) return;
    setLoaded(false);
    setLoading(true);
    setBpm(null);
    setTaps([]);
    setStartOffset(0);

    const src = '/' + path;
    const stem = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'beat';
    setId(stem);
    setTitle(stem.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    // Stop previous audio
    if (audioRef.current) audioRef.current.pause();

    // Playback — starts immediately (independent of analysis)
    const audio = new Audio(src);
    audio.loop = true;
    audio.play().catch(e => console.error('[calibrate] play failed', e));
    audioRef.current = audio;

    // Analysis — runs in parallel with playback
    try {
      const res = await fetch(src);
      const arrayBuffer = await res.arrayBuffer();
      const audioCtx = new AudioContext();
      try {
        const buffer = await audioCtx.decodeAudioData(arrayBuffer);
        // Dynamic import keeps music-tempo out of the main game bundle
        const MusicTempo = (await import('music-tempo')).default;
        const mt = new MusicTempo(buffer.getChannelData(0));
        const detectedBpm = Math.round(mt.tempo * 10) / 10;
        setBpm(detectedBpm);

        // Claude category suggestion
        const catRes = await fetch('/api/analyze-beat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bpm: detectedBpm, title: stem }),
        });
        if (catRes.ok) {
          const { category: suggested } = await catRes.json();
          if (CATEGORIES.includes(suggested)) setCategory(suggested);
        }
      } finally {
        audioCtx.close();
      }
    } catch (e) {
      console.error('[calibrate] analysis failed', e);
    }

    setLoading(false);
    setLoaded(true);
  }

  function handleTap() {
    const now = Date.now();
    const next = [...taps, now];
    if (next.length >= 2) {
      const intervals = next.slice(1).map((t, i) => t - next[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.round((60_000 / avg) * 10) / 10);
    }
    setTaps(next);
  }

  function handleMark() {
    const t = audioRef.current?.currentTime ?? 0;
    setStartOffset(Math.round(t * 1000) / 1000);
  }

  const output = loaded && bpm !== null
    ? `{
  id: '${id}',
  src: '/${path}',
  title: '${title}',
  bpm: ${bpm},
  barsPerLoop: /* fill in */,
  startOffset: ${startOffset},
  category: '${category}',
},`
    : null;

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto space-y-8">
      <h1 className="text-2xl font-extrabold">Beat Calibration</h1>

      {/* Step 1 — Load */}
      <section className="space-y-2">
        <p className="text-sm text-white/50">Step 1 — enter path relative to <code>public/</code></p>
        <div className="flex gap-2">
          <input
            value={path}
            onChange={e => setPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoad()}
            placeholder="beats/my-beat.mp3"
            className="flex-1 rounded-xl bg-white/10 px-4 py-2 text-sm outline-none focus:bg-white/15"
          />
          <button
            onClick={handleLoad}
            disabled={!path || loading}
            className="rounded-xl bg-rhyme-yellow text-bg px-4 py-2 font-bold text-sm disabled:opacity-50"
          >
            {loading ? '...' : 'Load'}
          </button>
        </div>
      </section>

      {loaded && (
        <>
          {/* Editable id / title */}
          <section className="flex gap-3">
            <div className="flex-1 space-y-1">
              <p className="text-xs text-white/40">ID</p>
              <input value={id} onChange={e => setId(e.target.value)}
                className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs text-white/40">Title</p>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none" />
            </div>
          </section>

          {/* Step 2 — BPM */}
          <section className="space-y-3">
            <p className="text-sm text-white/50">
              Step 2 — BPM{bpm !== null ? `: ${bpm}` : ' — detecting…'}
            </p>
            <div className="flex items-center gap-4">
              <button onClick={handleTap}
                className="rounded-xl bg-rhyme-orange px-6 py-3 font-bold text-lg">
                TAP
              </button>
              <span className="text-sm text-white/40">
                {taps.length} tap{taps.length !== 1 ? 's' : ''}
                {taps.length > 0 && (
                  <button onClick={() => setTaps([])} className="ml-2 underline">reset</button>
                )}
              </span>
            </div>
          </section>

          {/* Step 3 — Category */}
          <section className="space-y-3">
            <p className="text-sm text-white/50">Step 3 — Category (Claude suggestion applied)</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={[
                    'rounded-full px-4 py-1 text-sm font-bold border',
                    category === cat
                      ? 'bg-rhyme-yellow/20 border-rhyme-yellow text-rhyme-yellow'
                      : 'bg-white/5 border-transparent text-white/40',
                  ].join(' ')}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          {/* Step 4 — Mark beat 1 */}
          <section className="space-y-3">
            <p className="text-sm text-white/50">
              Step 4 — Mark beat 1 (current offset: {startOffset}s)
            </p>
            <button onClick={handleMark}
              className="rounded-xl bg-rhyme-blue px-6 py-3 font-bold">
              ▼ MARK BEAT 1
            </button>
          </section>

          {/* Step 5 — Output */}
          {output && (
            <section className="space-y-2">
              <p className="text-sm text-white/50">Step 5 — Copy to <code>lib/beats.ts</code></p>
              <pre className="rounded-xl bg-black/40 p-4 text-xs text-green-300 overflow-auto whitespace-pre">
                {output}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(output)}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm"
              >
                Copy to clipboard
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
