'use client';

import { useEffect, useState } from 'react';
import { BEATS, pickBeat, type Beat } from '@/lib/beats';
import { LANGUAGES, type LanguageId } from '@/lib/languages';
import { loadLanguage, saveLanguage } from '@/lib/language-storage';
import { isYouTubeUrl } from '@/lib/yt-beat';
import { BeatPicker } from './BeatPicker';
import { LanguagePicker } from './LanguagePicker';

type YtState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; beat: Beat; bpmFallback?: boolean }
  | { status: 'error'; message: string };

type Props = {
  initialBeatId: string | null;
  initialYtBeat?: Beat;
  initialLanguageId: LanguageId;
  onPlay: (beat: Beat, languageId: LanguageId) => void;
  onLogout: () => void;
};

export function Setup({ initialBeatId, initialYtBeat, initialLanguageId, onPlay, onLogout }: Props) {
  const [beatId, setBeatId] = useState<string | null>(
    initialYtBeat ? null : (initialBeatId ?? BEATS[0]?.id ?? null)
  );
  const [languageId, setLanguageId] = useState<LanguageId>(initialLanguageId);
  const [ytUrl, setYtUrl] = useState('');
  const [ytState, setYtState] = useState<YtState>(
    initialYtBeat ? { status: 'loaded', beat: initialYtBeat } : { status: 'idle' }
  );
  const [ytBeats, setYtBeats] = useState<Beat[]>([]);

  const fetchCatalog = () => {
    fetch('/beats/yt-catalog.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: Beat[]) => setYtBeats(data))
      .catch(() => {});
  };

  useEffect(() => {
    const resolved = loadLanguage();
    if (resolved !== languageId) setLanguageId(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseLanguage(id: LanguageId) {
    setLanguageId(id);
    saveLanguage(id);
  }

  // Picking from BeatPicker clears any loaded YT beat.
  function chooseBeat(id: string | null) {
    setBeatId(id);
    setYtUrl('');
    setYtState({ status: 'idle' });
  }

  async function loadYtBeat() {
    setYtState({ status: 'loading' });
    try {
      const res = await fetch('/api/yt-beat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: ytUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          json.error === 'ytdlp-not-found' ? 'yt-dlp is not installed on this server' :
          json.error === 'invalid-url'      ? 'Not a valid YouTube URL' :
          json.error === 'download-failed'  ? `Download failed: ${json.detail ?? ''}` :
          'Failed to load beat';
        setYtState({ status: 'error', message });
        return;
      }
      const beat: Beat = {
        id: json.id,
        src: json.src,
        title: json.title,
        bpm: json.bpm,
        barsPerLoop: json.barsPerLoop,
        category: json.category ?? 'other',
        ...(json.source === 'youtube' && { source: 'youtube' as const }),
      };
      // Loading a YT beat deselects the BeatPicker.
      setBeatId(null);
      setYtState({ status: 'loaded', beat, bpmFallback: json.bpmFallback });
      fetchCatalog();
    } catch {
      setYtState({ status: 'error', message: 'Network error' });
    }
  }

  // Active beat: YT beat takes priority, then BeatPicker selection.
  const activeBeat: Beat | null =
    ytState.status === 'loaded' ? ytState.beat :
    beatId ? (pickBeat(beatId) ?? null) : null;

  const canLoad = ytState.status !== 'loading' && isYouTubeUrl(ytUrl);
  const canPlay = activeBeat !== null;

  const allBeats = [...BEATS, ...ytBeats];

  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex justify-end">
        <button onClick={onLogout} className="text-white/60 hover:text-white">Log out</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-extrabold">The Rhyme Game</h1>
        <button
          onClick={() => activeBeat && onPlay(activeBeat, languageId)}
          disabled={!canPlay}
          className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
        >
          PLAY
        </button>
        <div className="w-full max-w-sm space-y-3">
          <BeatPicker beats={allBeats} selectedId={beatId} onChange={chooseBeat} />

          <div className="space-y-1">
            {ytState.status === 'loaded' ? (
              <div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
                <span className="truncate">
                  {ytState.beat.title} · {ytState.beat.bpm} BPM
                  {ytState.bpmFallback && ' (BPM ~90, auto-detect failed)'}
                </span>
                <button
                  onClick={() => { setYtUrl(''); setYtState({ status: 'idle' }); }}
                  className="ml-2 shrink-0 text-white/60 hover:text-white"
                  aria-label="Clear YouTube beat"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="YouTube URL"
                  value={ytUrl}
                  disabled={ytState.status === 'loading'}
                  onChange={e => {
                    setYtUrl(e.target.value);
                    setYtState({ status: 'idle' });
                  }}
                  className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm placeholder:text-white/40 outline-none disabled:opacity-40"
                />
                <button
                  onClick={loadYtBeat}
                  disabled={!canLoad}
                  className="rounded-xl bg-white/20 px-3 py-2 text-sm disabled:opacity-40"
                >
                  {ytState.status === 'loading' ? '…' : 'Load'}
                </button>
              </div>
            )}
            {ytState.status === 'error' && (
              <p className="text-xs text-red-400">{ytState.message}</p>
            )}
          </div>

          <LanguagePicker
            languages={LANGUAGES}
            selectedId={languageId}
            onChange={chooseLanguage}
          />
        </div>
      </div>
    </main>
  );
}
