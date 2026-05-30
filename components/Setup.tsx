'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BEATS, pickBeat, type Beat } from '@/lib/beats';
import { filterBeats, availableCategories, type BpmBucket, type CategoryChip } from '@/lib/beat-filters';
import { LANGUAGES, type LanguageId } from '@/lib/languages';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, type DifficultyId } from '@/lib/difficulties';
import { RHYME_SCHEMES, DEFAULT_SCHEME, type RhymeSchemeId } from '@/lib/rhyme-schemes';
import { loadLanguage, saveLanguage } from '@/lib/language-storage';
import { isYouTubeUrl } from '@/lib/yt-beat';
import { useBeatPreview } from '@/hooks/useBeatPreview';
import Link from 'next/link';
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

// ── style tokens (Ice & Chrome) ────────────────────────────────────
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(94,200,255,0.65)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070d16]';
const PILL_ACTIVE =
  `rounded-full px-4 py-2 text-sm text-center font-semibold text-white bg-[rgba(94,200,255,0.16)] border border-[rgba(94,200,255,0.6)] transition-colors ${FOCUS}`;
const PILL_INACTIVE =
  `rounded-full px-4 py-2 text-sm text-center text-white/70 bg-white/[0.035] border border-white/[0.07] transition-colors hover:bg-white/[0.08] hover:border-white/20 hover:text-white ${FOCUS}`;
// elevated translucent surface with internal gradient, top highlight, deep shadow
const CARD =
  'rounded-2xl border border-white/10 bg-gradient-to-b from-[rgba(94,200,255,0.06)] to-[rgba(94,200,255,0.015)] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_30px_60px_-34px_rgba(0,0,0,0.9)]';
// same surface, applied only at lg (the left panel is card-on-desktop, bare-on-mobile)
const CARD_LG =
  'lg:rounded-2xl lg:border lg:border-white/10 lg:bg-gradient-to-b lg:from-[rgba(94,200,255,0.06)] lg:to-[rgba(94,200,255,0.015)] lg:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_30px_60px_-34px_rgba(0,0,0,0.9)]';
const SCROLL = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const CHIP_ACTIVE =
  `rounded-full px-2.5 py-1 text-[11px] font-semibold text-white bg-[rgba(94,200,255,0.18)] border border-[rgba(94,200,255,0.5)] transition-colors ${FOCUS}`;
const CHIP_INACTIVE =
  `rounded-full px-2.5 py-1 text-[11px] text-white/55 bg-white/[0.035] border border-white/[0.07] transition-colors hover:bg-white/[0.08] hover:text-white ${FOCUS}`;
const BPM_BUCKETS: readonly [BpmBucket, string][] = [
  ['all', 'All BPM'], ['slow', '<85'], ['mid', '85–100'], ['fast', '>100'],
];

function fmtBpm(bpm: number): string {
  return String(Math.round(bpm));
}

function FieldLabel({ children }: { children: string }) {
  return (
    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
      {children}
    </p>
  );
}

function IconSearch({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconPlay({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function IconChevron({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFilter({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconShuffle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
      <path d="m18 14 4 4-4 4" />
    </svg>
  );
}

function NowPlaying() {
  return (
    <span
      data-testid="now-playing"
      role="img"
      aria-label="Now playing"
      className="flex h-3.5 items-end gap-[2px]"
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="block h-full w-[3px] rounded-full bg-[#5ec8ff]"
          style={{ transformOrigin: 'bottom', animation: 'yt-bar 0.9s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

// Neutral, single-tone tile (no per-beat colors) with a quiet play glyph.
function BeatTile({ previewing }: { previewing: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-[rgba(94,200,255,0.10)] transition-colors group-hover:bg-[rgba(94,200,255,0.16)]"
    >
      {previewing ? <NowPlaying /> : <IconPlay className="h-3 w-3 text-white/55" />}
    </span>
  );
}

function BeatMeta({ beat }: { beat: Beat }) {
  return (
    <span className="block text-[11px] uppercase tracking-wide text-white/60">
      {beat.source === 'youtube' ? 'youtube' : beat.category}
      {' · '}
      <span className="tabular-nums">{fmtBpm(beat.bpm)}</span> BPM
    </span>
  );
}

// entrance choreography
const containerV = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};
const itemV = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

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
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<BpmBucket>('all');
  const [category, setCategory] = useState<CategoryChip | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  const allBeats = useMemo(() => [...BEATS, ...ytBeats], [ytBeats]);

  const filteredBeats = useMemo(
    () => filterBeats(allBeats, { bucket, category, query }),
    [allBeats, bucket, category, query],
  );
  const cats = useMemo(() => availableCategories(allBeats), [allBeats]);
  const filtersActive = bucket !== 'all' || category !== 'all' || query.trim() !== '';
  function clearFilters() { setBucket('all'); setCategory('all'); setQuery(''); }

  function pickRandomBeat() {
    if (filteredBeats.length === 0) return;
    const b = filteredBeats[Math.floor(Math.random() * filteredBeats.length)];
    chooseBeat(b.id);
    startPreview(b);
  }

  const selectedBundled: Beat | null =
    beatId ? (pickBeat(beatId) ?? allBeats.find(b => b.id === beatId) ?? null) : null;

  const activeBeat: Beat | null = computeActiveBeat(
    beatSource, selectedBundled, ytState, selectedCatalogId, ytBeats,
  );

  const canLoad = ytState.status !== 'loading' && isYouTubeUrl(ytUrl);
  const canPlay = activeBeat !== null;

  // Shared segmented source toggle (rendered once → single layoutId).
  const sourceToggle = (
    <div className="relative grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
      {(['local', 'youtube'] as const).map(src => {
        const active = beatSource === src;
        return (
          <button
            key={src}
            type="button"
            onClick={() => setBeatSource(src)}
            className={`relative z-10 rounded-lg py-2 text-sm transition-colors ${FOCUS} ${active ? 'font-bold text-[#060c14]' : 'text-white/60 hover:text-white/90'}`}
          >
            {active && (
              <motion.span
                layoutId="beatSourcePill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-10 rounded-lg"
                style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset' }}
              />
            )}
            <span className="relative">{src === 'local' ? 'Local beats' : 'YouTube'}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <main className="relative flex h-[100svh] lg:h-auto lg:min-h-screen flex-col overflow-hidden lg:overflow-visible bg-[#070d16]">
      {/* Ambient background layers */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: 'radial-gradient(ellipse 70% 42% at 50% -8%, rgba(94,200,255,0.18), transparent 70%), radial-gradient(ellipse 55% 55% at 88% 118%, rgba(56,96,224,0.14), transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse 95% 85% at 50% 42%, transparent 52%, rgba(0,0,0,0.5))' }}
      />

      {/* TOP — brand bar (matches landing + login) */}
      <nav className="relative z-10 flex items-center justify-between h-16 px-6 md:px-12 shrink-0">
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
          className={`rounded-md px-1 text-xs text-white/70 hover:text-white transition-colors ${FOCUS}`}
        >
          Log out →
        </button>
      </nav>

      {/* CONTENT */}
      <div className="relative z-10 flex flex-1 min-h-0 flex-col items-center justify-start px-6 md:px-12 pt-4 lg:pt-6 pb-3 lg:pb-10">
        <motion.div
          variants={containerV}
          initial="hidden"
          animate="show"
          className="w-full max-w-md flex flex-1 min-h-0 flex-col lg:max-w-3xl lg:block"
        >

          {/* Header */}
          <motion.div variants={itemV} className="mb-3 lg:mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40">
              New round
            </p>
            <h1 className="mt-1 text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Set up your beat
            </h1>
          </motion.div>

          <div className="flex flex-1 min-h-0 flex-col space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-8 lg:items-stretch">

            {/* ── LEFT PANEL: beat browser (card on desktop, bare on mobile) ── */}
            <motion.div variants={itemV} className="lg:relative lg:min-h-0">
              <div className={`flex flex-col gap-3 lg:absolute lg:inset-0 lg:gap-0 lg:overflow-hidden lg:p-2 ${CARD_LG}`}>
                {sourceToggle}

                <AnimatePresence mode="wait">
                  {beatSource === 'local' ? (
                    <motion.div key="local" {...fadePanel} className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                      {/* Mobile/tablet: compact selected-beat button → modal */}
                      <button
                        ref={browseButtonRef}
                        type="button"
                        onClick={() => setBrowseOpen(true)}
                        className={`group lg:hidden w-full flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-left ${FOCUS}`}
                      >
                        {selectedBundled ? (
                          <>
                            <BeatTile previewing={previewingId === selectedBundled.id} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold">{selectedBundled.title}</span>
                              <BeatMeta beat={selectedBundled} />
                            </span>
                          </>
                        ) : (
                          <span className="flex-1 font-bold text-white/70">Pick a beat</span>
                        )}
                        <IconChevron className="h-4 w-4 text-white/45" />
                      </button>

                      {/* Desktop (lg+): inline searchable browser — search + filters + full list */}
                      <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:pt-2">
                        <div className="px-0.5 pb-2">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                              <input
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search beats…"
                                aria-label="Search beats"
                                className={`w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-3 py-2 text-sm placeholder:text-white/40 outline-none focus:border-[rgba(94,200,255,0.5)] transition-colors ${FOCUS}`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={pickRandomBeat}
                              disabled={filteredBeats.length === 0}
                              aria-label="Pick a random beat"
                              title="Random beat"
                              className={`grid w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/20 text-white/55 transition-colors hover:text-white disabled:opacity-40 ${FOCUS}`}
                            >
                              <IconShuffle className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFiltersOpen(o => !o)}
                              aria-expanded={filtersOpen}
                              aria-label="Filters"
                              className={`relative grid w-10 shrink-0 place-items-center rounded-lg border transition-colors ${FOCUS} ${
                                filtersOpen || filtersActive
                                  ? 'border-[rgba(94,200,255,0.5)] bg-[rgba(94,200,255,0.14)] text-white'
                                  : 'border-white/10 bg-black/20 text-white/55 hover:text-white'
                              }`}
                            >
                              <IconFilter className="h-4 w-4" />
                              {filtersActive && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#5ec8ff]" />}
                            </button>
                          </div>
                          <AnimatePresence initial={false}>
                            {filtersOpen && (
                              <motion.div
                                key="filters"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-2 pt-2">
                                  <div className="flex flex-wrap gap-1.5">
                                    {BPM_BUCKETS.map(([key, label]) => (
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => setBucket(key)}
                                        aria-pressed={bucket === key}
                                        className={bucket === key ? CHIP_ACTIVE : CHIP_INACTIVE}
                                      >{label}</button>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setCategory('all')}
                                      aria-pressed={category === 'all'}
                                      className={category === 'all' ? CHIP_ACTIVE : CHIP_INACTIVE}
                                    >All</button>
                                    {cats.map(cat => (
                                      <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategory(cat)}
                                        aria-pressed={category === cat}
                                        className={category === cat ? CHIP_ACTIVE : CHIP_INACTIVE}
                                      >{cat === 'youtube' ? 'YouTube' : cat}</button>
                                    ))}
                                  </div>
                                  {filtersActive && (
                                    <button
                                      type="button"
                                      onClick={clearFilters}
                                      className={`text-[11px] text-[#5ec8ff] hover:underline ${FOCUS}`}
                                    >Clear filters</button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div
                          data-testid="desktop-beat-list"
                          className={`min-h-0 flex-1 overflow-y-auto px-0.5 pb-0.5 space-y-0.5 [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-12px),transparent)] ${SCROLL}`}
                        >
                          {filteredBeats.map(b => {
                            const selected = b.id === beatId && beatSource === 'local';
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => { chooseBeat(b.id); startPreview(b); }}
                                aria-current={selected ? 'true' : undefined}
                                className={[
                                  'group w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all',
                                  FOCUS,
                                  selected
                                    ? 'bg-[rgba(94,200,255,0.13)] border border-[rgba(94,200,255,0.32)]'
                                    : 'border border-transparent hover:bg-[rgba(94,200,255,0.06)] hover:translate-x-0.5',
                                ].join(' ')}
                              >
                                <BeatTile previewing={previewingId === b.id} />
                                <span className="min-w-0 flex-1">
                                  <span className={`block truncate text-sm font-bold ${selected ? 'text-white' : 'text-white/90'}`}>
                                    {b.title}
                                  </span>
                                  <BeatMeta beat={b} />
                                </span>
                                {selected && <IconCheck className="h-4 w-4 shrink-0 text-[#5ec8ff]" />}
                              </button>
                            );
                          })}
                          {filteredBeats.length === 0 && (
                            <div className="px-3 py-10 text-center text-sm text-white/45">
                              No beats match these filters.
                              {filtersActive && (
                                <button
                                  type="button"
                                  onClick={clearFilters}
                                  className={`mx-auto mt-2 block text-xs text-[#5ec8ff] underline ${FOCUS}`}
                                >Clear filters</button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="youtube" {...fadePanel} className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:pt-2">
                      {/* URL input / loading / loaded chip */}
                      {ytState.status === 'loading' ? (
                        <YtLoadingState className="py-2" />
                      ) : ytState.status === 'loaded' ? (
                        <div className="flex items-center justify-between rounded-xl bg-[rgba(94,200,255,0.12)] border border-[rgba(94,200,255,0.25)] px-3 py-2 text-sm">
                          <span className="truncate">
                            {ytState.beat.title} · <span className="tabular-nums">{fmtBpm(ytState.beat.bpm)}</span> BPM
                            {ytState.bpmFallback && ' (BPM ~90, auto-detect failed)'}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setYtUrl(''); setYtState({ status: 'idle' }); }}
                            className={`ml-2 shrink-0 text-white/60 hover:text-white ${FOCUS}`}
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
                            className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:text-white/45 outline-none focus:border-[rgba(94,200,255,0.6)] transition-colors disabled:opacity-40"
                          />
                          <button
                            type="button"
                            onClick={loadYtBeat}
                            disabled={!canLoad}
                            aria-label="Load YouTube beat"
                            className={`rounded-xl px-4 py-2 text-sm font-bold text-[#060c14] disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`}
                            style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
                          >Load</button>
                        </div>
                      )}
                      {ytState.status === 'error' && (
                        <p className="text-xs text-red-400">{ytState.message}</p>
                      )}

                      {/* Recent catalog */}
                      <div className="min-h-0 lg:flex-1">
                        {ytBeats.length > 0 ? (
                          <div className="flex h-full min-h-0 flex-col">
                            <p className="px-1 pb-1 text-[10px] uppercase tracking-wider text-white/40">Recent</p>
                            <div className={`min-h-0 lg:flex-1 lg:overflow-y-auto space-y-0.5 ${SCROLL}`}>
                              {ytBeats.map((b, i) => {
                                const selected = selectedCatalogId === b.id && ytState.status !== 'loaded';
                                return (
                                  <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCatalogId(b.id);
                                      setYtUrl('');
                                      setYtState({ status: 'idle' });
                                    }}
                                    aria-current={selected ? 'true' : undefined}
                                    className={[
                                      'group w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                                      FOCUS,
                                      selected
                                        ? 'bg-[rgba(94,200,255,0.13)] border border-[rgba(94,200,255,0.32)]'
                                        : 'border border-transparent text-white/85 hover:bg-[rgba(94,200,255,0.06)]',
                                      !showAll && i >= 5 ? 'hidden lg:flex' : 'flex',
                                    ].join(' ')}
                                  >
                                    <BeatTile previewing={previewingId === b.id} />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-bold">{b.title}</span>
                                      <BeatMeta beat={b} />
                                    </span>
                                    {selected && <IconCheck className="h-4 w-4 shrink-0 text-[#5ec8ff]" />}
                                  </button>
                                );
                              })}
                            </div>
                            {ytBeats.length > 5 && !showAll && (
                              <button
                                type="button"
                                onClick={() => setShowAll(true)}
                                className={`lg:hidden w-full text-center text-xs text-white/45 hover:text-white/75 py-1 ${FOCUS}`}
                              >Show all ({ytBeats.length}) →</button>
                            )}
                          </div>
                        ) : (
                          <div className="hidden lg:flex h-full items-center justify-center px-6 text-center text-xs text-white/45">
                            Paste a YouTube link above to add a beat.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected beat — pinned to the bottom of the left panel (desktop) */}
                <div className="hidden lg:flex items-center gap-3 -mx-2 -mb-2 mt-2 border-t border-white/10 bg-black/20 px-3 py-2.5">
                  {activeBeat ? (
                    <>
                      <BeatTile previewing={previewingId === activeBeat.id} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{activeBeat.title}</span>
                        <BeatMeta beat={activeBeat} />
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Selected</span>
                    </>
                  ) : (
                    <span className="text-sm text-white/50">Pick a beat to play</span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ── RIGHT PANEL: options + PLAY ── */}
            <motion.div variants={itemV} className="flex flex-1 min-h-0 flex-col gap-3 lg:flex-none lg:gap-4">
              {/* Options grouped in one labeled card (spacing, not hard dividers).
                  On mobile this card absorbs leftover space and scrolls internally; on lg it's natural-height. */}
              <div className={`${CARD} flex-1 min-h-0 overflow-y-auto p-4 space-y-4 lg:flex-none lg:overflow-visible lg:p-5 lg:space-y-5 ${SCROLL}`}>
                <div>
                  <FieldLabel>Language</FieldLabel>
                  <LanguagePicker
                    languages={LANGUAGES}
                    selectedId={languageId}
                    onChange={chooseLanguage}
                    className="grid grid-cols-2 gap-2"
                    activeClassName={PILL_ACTIVE}
                    inactiveClassName={PILL_INACTIVE}
                  />
                </div>
                <div>
                  <FieldLabel>Difficulty</FieldLabel>
                  <DifficultyPicker
                    difficulties={DIFFICULTIES}
                    selectedId={difficultyId}
                    onChange={setDifficultyId}
                    className="grid grid-cols-2 gap-2"
                    activeClassName={PILL_ACTIVE}
                    inactiveClassName={PILL_INACTIVE}
                  />
                </div>
                <div>
                  <FieldLabel>Rhyme scheme</FieldLabel>
                  <RhymeSchemePicker
                    schemes={RHYME_SCHEMES}
                    selectedId={schemeId}
                    onChange={setSchemeId}
                    className="grid grid-cols-4 gap-2"
                    activeClassName={PILL_ACTIVE}
                    inactiveClassName={PILL_INACTIVE}
                  />
                </div>
              </div>

              {/* PLAY */}
              <div className="lg:mt-auto">
                <motion.button
                  type="button"
                  whileHover={canPlay ? { scale: 1.01, y: -1 } : {}}
                  whileTap={canPlay ? { scale: 0.98 } : {}}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                  onClick={() => activeBeat && onPlay(activeBeat, languageId, difficultyId, schemeId)}
                  disabled={!canPlay}
                  className={`relative w-full overflow-hidden rounded-2xl py-3.5 lg:py-4 text-2xl font-extrabold text-[#06101f] disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`}
                  style={{
                    background: 'linear-gradient(135deg,#6fcdff 0%,#3a9bf0 50%,#2a63d6 100%)',
                    boxShadow: canPlay
                      ? '0 8px 26px -10px rgba(94,200,255,0.5), 0 1px 0 rgba(255,255,255,0.5) inset'
                      : 'none',
                  }}
                >
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22), transparent)' }} />
                  <span className="relative z-10 flex items-center justify-center gap-2.5">
                    <IconPlay className="h-5 w-5" />
                    PLAY
                  </span>
                </motion.button>
              </div>
            </motion.div>

          </div>
        </motion.div>
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
