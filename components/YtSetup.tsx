// components/YtSetup.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
  errorMessage?: string | null;
};

const VALID_CATEGORIES = new Set<BeatCategory>(['boom-bap', 'trap', 'jazz', 'lo-fi', 'drill', 'other']);

export function buildYtBeat(json: {
  id: string;
  src: string;
  title: string;
  bpm: number;
  barsPerLoop: number;
  category?: string;
  source?: string;
}): Beat {
  const category: BeatCategory =
    json.category !== undefined && VALID_CATEGORIES.has(json.category as BeatCategory)
      ? (json.category as BeatCategory)
      : 'other';
  return {
    id: json.id,
    src: json.src,
    title: json.title,
    bpm: json.bpm,
    barsPerLoop: json.barsPerLoop,
    category,
    ...(json.source === 'youtube' && { source: 'youtube' as const }),
  };
}

const PICKER_CONTAINER = 'w-full flex flex-wrap justify-center gap-2 rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3';
const PICKER_ACTIVE = 'rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white';
const PICKER_INACTIVE = 'rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60';

export function YtSetup({ onPlay, onLogout, errorMessage }: Props) {
  const [languageId, setLanguageId] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
  const [schemeId, setSchemeId] = useState<RhymeSchemeId>(DEFAULT_SCHEME);
  const [ytUrl, setYtUrl] = useState('');
  const [ytState, setYtState] = useState<YtState>({ status: 'idle' });
  const [ytBeats, setYtBeats] = useState<Beat[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);

  const fetchCatalog = useCallback(() => {
    fetch('/beats/yt-catalog.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: Beat[]) => setYtBeats(data))
      .catch((err) => { if (process.env.NODE_ENV !== 'production') console.error('catalog fetch failed', err); });
  }, []);

  useEffect(() => {
    setLanguageId(loadLanguage());
    fetchCatalog();
    return () => { loadAbortRef.current?.abort(); };
  }, [fetchCatalog]);

  function chooseLanguage(id: LanguageId) {
    setLanguageId(id);
    saveLanguage(id);
  }

  async function loadYtBeat() {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setYtState({ status: 'loading' });
    try {
      const res = await fetch('/api/yt-beat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: ytUrl }),
        signal: controller.signal,
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
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
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

  return (
    <main
      className="flex min-h-screen flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      {/* TOP — brand bar (matches landing + login + setup) */}
      <nav className="flex items-center justify-between h-16 px-6 md:px-12 shrink-0">
        <Link
          href="/"
          className="font-extrabold text-sm tracking-wide hover:opacity-80 transition-opacity"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          THE RHYME GAME
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="text-xs text-white/55 hover:text-white/80 transition-colors"
        >
          Log out →
        </button>
      </nav>

      {/* CONTENT — anchored near the top */}
      <div className="flex flex-1 flex-col items-center justify-start px-6 md:px-12 pt-4 md:pt-8 pb-8">
        {errorMessage && (
          <div className="w-full max-w-sm rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-400 mb-4">
            {errorMessage}
          </div>
        )}

        <div className="w-full max-w-sm md:max-w-3xl md:grid md:grid-cols-[1.2fr_1fr] md:gap-8">

          {/* ── LEFT COLUMN: URL input + catalog ── */}
          <div className="space-y-1">
            {ytState.status === 'loading' ? (
              <YtLoadingState className="py-2" />
            ) : ytState.status === 'loaded' ? (
              <div className="flex items-center justify-between rounded-xl bg-[rgba(94,200,255,0.12)] border border-[rgba(94,200,255,0.25)] px-3 py-2 text-sm">
                <span className="truncate">
                  {ytState.beat.title} · {ytState.beat.bpm.toFixed(1)} BPM
                  {ytState.bpmFallback && ' (BPM ~90, auto-detect failed)'}
                </span>
                <button
                  type="button"
                  onClick={() => { setYtUrl(''); setYtState({ status: 'idle' }); }}
                  className="ml-2 shrink-0 text-white/60 hover:text-white"
                  aria-label="Clear YouTube beat"
                >✕</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Paste YouTube URL…"
                  value={ytUrl}
                  onChange={e => { setYtUrl(e.target.value); setYtState({ status: 'idle' }); }}
                  className="flex-1 rounded-xl bg-[rgba(94,200,255,0.06)] border border-[rgba(94,200,255,0.30)] px-3 py-2 text-sm placeholder:text-white/40 outline-none disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={loadYtBeat}
                  disabled={!canLoad}
                  aria-label="Load YouTube beat"
                  className="rounded-xl px-3 py-2 text-sm font-bold text-[#060c14] disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
                >Load</button>
              </div>
            )}
            {ytState.status === 'error' && (
              <p className="text-xs text-red-400">{ytState.message}</p>
            )}

            {/* Catalog — full-list render with CSS show/hide for mobile truncation */}
            <div className="pt-2">
              {ytBeats.length === 0 ? (
                <p className="text-center text-sm text-white/40">
                  No beats yet — paste a URL above.
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs tracking-widest text-white/40 uppercase mb-2">
                    Or pick from catalog
                  </p>
                  {ytBeats.map((b, i) => (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => selectFromCatalog(b.id)}
                      className={[
                        'w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-left',
                        selectedCatalogId === b.id && ytState.status !== 'loaded'
                          ? 'bg-[rgba(94,200,255,0.12)] border border-[rgba(94,200,255,0.25)] text-white'
                          : 'bg-[rgba(94,200,255,0.04)] text-white/70 hover:bg-[rgba(94,200,255,0.08)]',
                        !showAll && i >= 5 ? 'hidden md:flex' : 'flex',
                      ].join(' ')}
                    >
                      <span className="truncate">{b.title}</span>
                      <span className="text-white/40 ml-2 shrink-0">{b.bpm.toFixed(1)} BPM</span>
                    </button>
                  ))}
                  {ytBeats.length > 5 && !showAll && (
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className="md:hidden w-full text-center text-xs text-white/40 hover:text-white/70 py-1"
                    >
                      Show all ({ytBeats.length}) →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: pickers + PLAY ── */}
          <div className="flex flex-col gap-3 mt-6 md:mt-0">
            <LanguagePicker
              languages={LANGUAGES}
              selectedId={languageId}
              onChange={chooseLanguage}
              className={PICKER_CONTAINER}
              activeClassName={PICKER_ACTIVE}
              inactiveClassName={PICKER_INACTIVE}
            />
            <DifficultyPicker
              difficulties={DIFFICULTIES}
              selectedId={difficultyId}
              onChange={setDifficultyId}
              className={PICKER_CONTAINER}
              activeClassName={PICKER_ACTIVE}
              inactiveClassName={PICKER_INACTIVE}
            />
            <RhymeSchemePicker
              schemes={RHYME_SCHEMES}
              selectedId={schemeId}
              onChange={setSchemeId}
              className={PICKER_CONTAINER}
              activeClassName={PICKER_ACTIVE}
              inactiveClassName={PICKER_INACTIVE}
            />
            <motion.button
              type="button"
              whileTap={canPlay ? { scale: 0.96 } : {}}
              transition={{ duration: 0.1 }}
              onClick={() => activeBeat && onPlay(activeBeat, languageId, difficultyId, schemeId)}
              disabled={!canPlay}
              className="rounded-2xl px-12 py-5 text-3xl font-extrabold text-[#060c14] disabled:opacity-40 block mx-auto md:mx-0 md:w-full md:mt-auto"
              style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', boxShadow: canPlay ? '0 0 32px rgba(94,200,255,0.45)' : 'none' }}
            >
              PLAY
            </motion.button>
          </div>

        </div>
      </div>
    </main>
  );
}
