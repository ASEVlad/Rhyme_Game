'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BEATS, pickBeat, type Beat } from '@/lib/beats';
import { LANGUAGES, type LanguageId } from '@/lib/languages';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, type DifficultyId } from '@/lib/difficulties';
import { RHYME_SCHEMES, DEFAULT_SCHEME, type RhymeSchemeId } from '@/lib/rhyme-schemes';
import { loadLanguage, saveLanguage } from '@/lib/language-storage';
import { isYouTubeUrl } from '@/lib/yt-beat';
import { useBeatPreview } from '@/hooks/useBeatPreview';
import { BrowseBeats } from './BrowseBeats';
import { LanguagePicker } from './LanguagePicker';
import { DifficultyPicker } from './DifficultyPicker';
import { RhymeSchemePicker } from './RhymeSchemePicker';
import { YtLoadingState } from './YtLoadingState';
import { fadePanel } from '@/lib/motion-variants';

type YtState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; beat: Beat; bpmFallback?: boolean }
  | { status: 'error'; message: string };

export type BeatSource = 'local' | 'youtube';

export function computeActiveBeat(
  beatSource: BeatSource,
  selectedBundled: Beat | null,
  ytState: YtState,
  selectedCatalogId: string | null,
  ytBeats: Beat[],
): Beat | null {
  if (beatSource === 'local') return selectedBundled;
  const urlBeat = ytState.status === 'loaded' ? ytState.beat : null;
  const catalogBeat = selectedCatalogId
    ? ytBeats.find(b => b.id === selectedCatalogId) ?? null
    : null;
  return urlBeat ?? catalogBeat;
}

type Props = {
  initialBeatId: string | null;
  initialYtBeat?: Beat;
  initialLanguageId: LanguageId;
  onPlay: (beat: Beat, languageId: LanguageId, difficultyId: DifficultyId, schemeId: RhymeSchemeId) => void;
  onLogout: () => void;
};

export function Setup({ initialBeatId, initialYtBeat, initialLanguageId, onPlay, onLogout }: Props) {
  const [beatId, setBeatId] = useState<string | null>(
    initialYtBeat ? null : (initialBeatId ?? BEATS[0]?.id ?? null)
  );
  const [languageId, setLanguageId] = useState<LanguageId>(initialLanguageId);
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
  const [schemeId, setSchemeId] = useState<RhymeSchemeId>(DEFAULT_SCHEME);
  const [ytUrl, setYtUrl] = useState('');
  const [ytState, setYtState] = useState<YtState>(
    initialYtBeat ? { status: 'loaded', beat: initialYtBeat } : { status: 'idle' }
  );
  const [ytBeats, setYtBeats] = useState<Beat[]>([]);
  const [browseOpen, setBrowseOpen] = useState(false);
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const [beatSource, setBeatSource] = useState<BeatSource>(
    initialYtBeat ? 'youtube' : 'local'
  );
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { previewingId, startPreview } = useBeatPreview();

  const fetchCatalog = useCallback(() => {
    fetch('/beats/yt-catalog.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: Beat[]) => setYtBeats(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const resolved = loadLanguage();
    if (resolved !== languageId) setLanguageId(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  function chooseLanguage(id: LanguageId) {
    setLanguageId(id);
    saveLanguage(id);
  }

  function chooseBeat(id: string | null) {
    setBeatSource('local');
    setBeatId(id);
    setYtUrl('');
    setYtState({ status: 'idle' });
    setSelectedCatalogId(null);
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
      setBeatId(null);
      setYtState({ status: 'loaded', beat, bpmFallback: json.bpmFallback });
      fetchCatalog();
    } catch {
      setYtState({ status: 'error', message: 'Network error' });
    }
  }

  const allBeats = [...BEATS, ...ytBeats];

  const selectedBundled: Beat | null =
    beatId ? (pickBeat(beatId) ?? allBeats.find(b => b.id === beatId) ?? null) : null;

  const activeBeat: Beat | null = computeActiveBeat(
    beatSource, selectedBundled, ytState, selectedCatalogId, ytBeats,
  );

  const canLoad = ytState.status !== 'loading' && isYouTubeUrl(ytUrl);
  const canPlay = activeBeat !== null;

  return (
    <main
      className="flex min-h-screen flex-col p-6 bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      <div className="flex justify-end">
        <button onClick={onLogout} className="text-white/60 hover:text-white text-sm">Log out</button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1
          className="text-4xl font-extrabold tracking-tight"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          The Rhyme Game
        </h1>

        <div className="w-full max-w-sm md:max-w-3xl space-y-3 md:space-y-0 md:grid md:grid-cols-[1.2fr_1fr] md:gap-8">

          {/* ── LEFT COLUMN: beat source + beat picker ── */}
          <div className="space-y-3">
            {/* Beat source toggle */}
            <div className="w-full rounded-xl bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)] p-1 flex gap-1">
              <button
                type="button"
                onClick={() => setBeatSource('local')}
                className={beatSource === 'local'
                  ? 'flex-1 rounded-lg font-bold py-2 text-sm text-[#060c14]'
                  : 'flex-1 rounded-lg bg-transparent text-white/50 py-2 text-sm'}
                style={beatSource === 'local' ? { background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', boxShadow: '0 0 12px rgba(94,200,255,0.35)' } : undefined}
              >
                Local beats
              </button>
              <button
                type="button"
                onClick={() => setBeatSource('youtube')}
                className={beatSource === 'youtube'
                  ? 'flex-1 rounded-lg font-bold py-2 text-sm text-[#060c14]'
                  : 'flex-1 rounded-lg bg-transparent text-white/50 py-2 text-sm'}
                style={beatSource === 'youtube' ? { background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', boxShadow: '0 0 12px rgba(94,200,255,0.35)' } : undefined}
              >
                YouTube
              </button>
            </div>

            {/* Beat area — switches based on beatSource */}
            <AnimatePresence mode="wait">
              {beatSource === 'local' ? (
                <motion.div key="local" {...fadePanel}>
                  {/* Mobile: opens full BrowseBeats modal */}
                  <button
                    ref={browseButtonRef}
                    type="button"
                    aria-label="Open beat picker"
                    onClick={() => setBrowseOpen(true)}
                    className="md:hidden w-full flex items-center justify-between rounded-2xl bg-[rgba(94,200,255,0.06)] border border-[rgba(94,200,255,0.14)] px-4 py-3 text-left"
                  >
                    <span className="font-bold truncate">{selectedBundled?.title ?? 'Pick a beat'}</span>
                    <span className="flex items-center gap-2 text-[rgba(94,200,255,0.5)] text-sm">
                      {selectedBundled ? `${Number.isInteger(selectedBundled.bpm) ? selectedBundled.bpm : selectedBundled.bpm.toFixed(1)} BPM` : ''}
                      <span aria-hidden="true">›</span>
                    </span>
                  </button>

                  {/* Desktop: inline scrollable list + Browse all button */}
                  <div className="hidden md:block rounded-2xl bg-[rgba(94,200,255,0.04)] border border-[rgba(94,200,255,0.10)] overflow-hidden">
                    <div className="max-h-72 overflow-y-auto">
                      {allBeats.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => { chooseBeat(b.id); startPreview(b); }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-[rgba(94,200,255,0.06)] transition-colors ${
                            b.id === beatId && beatSource === 'local'
                              ? 'bg-[rgba(94,200,255,0.12)] text-white'
                              : 'text-white/70'
                          }`}
                        >
                          <span className="truncate">{b.title}</span>
                          <span className="flex items-center gap-2 ml-2 shrink-0">
                            {previewingId === b.id && (
                              <span aria-hidden="true" className="text-[#5ec8ff] text-xs">▮▮</span>
                            )}
                            <span className="text-white/40 text-xs">
                              {Number.isInteger(b.bpm) ? b.bpm : b.bpm.toFixed(1)} BPM
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBrowseOpen(true)}
                      className="w-full px-4 py-2.5 text-xs text-[rgba(94,200,255,0.5)] hover:text-[rgba(94,200,255,0.8)] border-t border-[rgba(94,200,255,0.10)] text-left transition-colors"
                    >
                      Browse all / search…
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="youtube" {...fadePanel} className="space-y-2">
                  {/* URL input / loading / loaded chip */}
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

                  {/* Inline catalog */}
                  {ytBeats.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[10px] text-[rgba(94,200,255,0.45)] uppercase tracking-wider">Recent</p>
                      {ytBeats.map((b, i) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setSelectedCatalogId(b.id);
                            setYtUrl('');
                            setYtState({ status: 'idle' });
                          }}
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
                        >Show all ({ytBeats.length}) →</button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── RIGHT COLUMN: options + PLAY ── */}
          <div className="flex flex-col gap-3">
            {/* Divider — visible on mobile only */}
            <div className="border-t border-[rgba(94,200,255,0.10)] my-1 md:hidden" />

            <LanguagePicker
              languages={LANGUAGES}
              selectedId={languageId}
              onChange={chooseLanguage}
              className="w-full flex flex-wrap justify-center gap-2 rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3"
              activeClassName="rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white"
              inactiveClassName="rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60"
            />
            <DifficultyPicker
              difficulties={DIFFICULTIES}
              selectedId={difficultyId}
              onChange={setDifficultyId}
              className="w-full flex flex-wrap justify-center gap-2 rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3"
              activeClassName="rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white"
              inactiveClassName="rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60"
            />
            <RhymeSchemePicker
              schemes={RHYME_SCHEMES}
              selectedId={schemeId}
              onChange={setSchemeId}
              className="w-full flex flex-wrap justify-center gap-2 rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3"
              activeClassName="rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white"
              inactiveClassName="rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60"
            />

            {/* PLAY — moved from below the container into the right column */}
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

      <AnimatePresence>
        {browseOpen && (
          <motion.div
            key="browse"
            className="fixed inset-0 z-50"
            {...fadePanel}
          >
            <BrowseBeats
              beats={allBeats}
              selectedId={beatId}
              onChange={(id) => { chooseBeat(id); }}
              onClose={() => { setBrowseOpen(false); browseButtonRef.current?.focus(); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
