// components/YtSetup.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Beat, BeatCategory } from '@/lib/beats';
import { LANGUAGES, DEFAULT_LANGUAGE, type LanguageId } from '@/lib/languages';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, type DifficultyId } from '@/lib/difficulties';
import { RHYME_SCHEMES, DEFAULT_SCHEME, type RhymeSchemeId } from '@/lib/rhyme-schemes';
import { loadLanguage, saveLanguage } from '@/lib/language-storage';
import { isYouTubeUrl } from '@/lib/yt-beat';
import { LanguagePicker } from './LanguagePicker';
import { DifficultyPicker } from './DifficultyPicker';
import { RhymeSchemePicker } from './RhymeSchemePicker';
import { YtLoadingState } from './YtLoadingState';

type YtState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; beat: Beat; bpmFallback?: boolean }
  | { status: 'error'; message: string };

type Props = {
  onPlay: (beat: Beat, lang: LanguageId, difficulty: DifficultyId, scheme: RhymeSchemeId) => void;
  onLogout: () => void;
};

export function buildYtBeat(json: {
  id: string;
  src: string;
  title: string;
  bpm: number;
  barsPerLoop: number;
  category?: string;
  source?: string;
}): Beat {
  return {
    id: json.id,
    src: json.src,
    title: json.title,
    bpm: json.bpm,
    barsPerLoop: json.barsPerLoop,
    category: (json.category ?? 'other') as BeatCategory,
    ...(json.source === 'youtube' && { source: 'youtube' as const }),
  };
}

export function YtSetup({ onPlay, onLogout }: Props) {
  const [languageId, setLanguageId] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
  const [schemeId, setSchemeId] = useState<RhymeSchemeId>(DEFAULT_SCHEME);
  const [ytUrl, setYtUrl] = useState('');
  const [ytState, setYtState] = useState<YtState>({ status: 'idle' });
  const [ytBeats, setYtBeats] = useState<Beat[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);

  const fetchCatalog = useCallback(() => {
    fetch('/beats/yt-catalog.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: Beat[]) => setYtBeats(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLanguageId(loadLanguage());
    fetchCatalog();
  }, [fetchCatalog]);

  function chooseLanguage(id: LanguageId) {
    setLanguageId(id);
    saveLanguage(id);
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
      setSelectedCatalogId(null);
      setYtState({ status: 'loaded', beat: buildYtBeat(json), bpmFallback: json.bpmFallback });
      fetchCatalog();
    } catch {
      setYtState({ status: 'error', message: 'Network error' });
    }
  }

  function selectFromCatalog(id: string) {
    setSelectedCatalogId(id);
    setYtUrl('');
    setYtState({ status: 'idle' });
  }

  const urlBeat = ytState.status === 'loaded' ? ytState.beat : null;
  const catalogBeat = selectedCatalogId
    ? ytBeats.find(b => b.id === selectedCatalogId) ?? null
    : null;
  const activeBeat: Beat | null = urlBeat ?? catalogBeat;

  const canLoad = ytState.status !== 'loading' && isYouTubeUrl(ytUrl);
  const canPlay = activeBeat !== null;
  const visibleBeats = showAll ? ytBeats : ytBeats.slice(0, 5);

  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex justify-between">
        <Link href="/" className="text-white/60 hover:text-white text-sm">← Back</Link>
        <button onClick={onLogout} className="text-white/60 hover:text-white text-sm">Log out</button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 mt-6">
        <h1 className="text-4xl font-extrabold">YouTube Mode</h1>

        {/* URL input / loading state / loaded chip */}
        <div className="w-full max-w-sm space-y-1">
          {ytState.status === 'loading' ? (
            <YtLoadingState className="py-2" />
          ) : ytState.status === 'loaded' ? (
            <div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
              <span className="truncate">
                {ytState.beat.title} · {ytState.beat.bpm} BPM
                {ytState.bpmFallback && ' (BPM ~90, auto-detect failed)'}
              </span>
              <button
                onClick={() => { setYtUrl(''); setYtState({ status: 'idle' }); }}
                className="ml-2 shrink-0 text-white/60 hover:text-white"
                aria-label="Clear YouTube beat"
              >✕</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="YouTube URL"
                value={ytUrl}
                onChange={e => { setYtUrl(e.target.value); setYtState({ status: 'idle' }); }}
                className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm placeholder:text-white/40 outline-none"
              />
              <button
                onClick={loadYtBeat}
                disabled={!canLoad}
                className="rounded-xl bg-white/20 px-3 py-2 text-sm disabled:opacity-40"
              >Load</button>
            </div>
          )}
          {ytState.status === 'error' && (
            <p className="text-xs text-red-400">{ytState.message}</p>
          )}
        </div>

        {/* Catalog */}
        <div className="w-full max-w-sm">
          {ytBeats.length === 0 ? (
            <p className="text-center text-sm text-white/40">
              No beats yet — paste a URL above.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-white/40 uppercase tracking-wide mb-2">
                Or pick from catalog
              </p>
              {visibleBeats.map(b => (
                <button
                  key={b.id}
                  onClick={() => selectFromCatalog(b.id)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm text-left ${
                    selectedCatalogId === b.id && ytState.status !== 'loaded'
                      ? 'bg-white/20 text-white'
                      : 'bg-white/[0.06] text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span className="truncate">{b.title}</span>
                  <span className="text-white/40 ml-2 shrink-0">{b.bpm} BPM</span>
                </button>
              ))}
              {ytBeats.length > 5 && !showAll && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full text-center text-xs text-white/40 hover:text-white/70 py-1"
                >
                  Show all ({ytBeats.length}) →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pickers */}
        <div className="w-full max-w-sm space-y-3">
          <LanguagePicker languages={LANGUAGES} selectedId={languageId} onChange={chooseLanguage} />
          <DifficultyPicker difficulties={DIFFICULTIES} selectedId={difficultyId} onChange={setDifficultyId} />
          <RhymeSchemePicker schemes={RHYME_SCHEMES} selectedId={schemeId} onChange={setSchemeId} />
        </div>

        {/* PLAY */}
        <button
          onClick={() => activeBeat && onPlay(activeBeat, languageId, difficultyId, schemeId)}
          disabled={!canPlay}
          className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
        >
          PLAY
        </button>
      </div>
    </main>
  );
}
