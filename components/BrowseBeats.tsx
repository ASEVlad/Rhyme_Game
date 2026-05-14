// components/BrowseBeats.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Beat } from '@/lib/beats';
import {
  buildSectionLists, availableCategories,
  type BpmBucket, type CategoryChip, type FilterCriteria,
} from '@/lib/beat-filters';
import { loadRecentBeats } from '@/lib/recent-beats';

type Props = {
  beats: Beat[];                       // typically allBeats = [...BEATS, ...ytCatalog]
  selectedId: string | null;
  onChange: (id: string) => void;
  onClose: () => void;
};

const AUTO_STOP_MS = 8000;

export function computePreviewStart(beat: Beat, duration: number): number {
  const desired = beat.previewOffset ?? ((beat.startOffset ?? 0) + 8);
  return Math.min(desired, Math.max(0, duration - 1));
}

export function BrowseBeats({ beats, selectedId, onChange, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<BpmBucket>('all');
  const [category, setCategory] = useState<CategoryChip | 'all'>('all');
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Read recents after mount (avoid SSR/hydration mismatch).
  useEffect(() => { setRecentIds(loadRecentBeats()); }, []);

  // Focus the close button on mount; cleanup pauses preview + clears timer on unmount.
  useEffect(() => {
    closeBtnRef.current?.focus();
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  // Esc closes the modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const criteria: FilterCriteria = { bucket, category, query };
  const { recents, main, emptyAfterFilter } = useMemo(
    () => buildSectionLists(beats, recentIds, criteria),
    [beats, recentIds, bucket, category, query],
  );
  const cats = useMemo(() => availableCategories(beats), [beats]);

  function stopPreview() {
    if (audioRef.current) { audioRef.current.pause(); }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    setPreviewingId(null);
  }

  function startPreview(beat: Beat) {
    stopPreview();
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.src = beat.src;
    const onMeta = () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.currentTime = computePreviewStart(beat, audio.duration || 0);
      audio.play().catch(() => {
        console.warn('[BrowseBeats] preview play failed');
        setPreviewingId(null);
      });
      stopTimerRef.current = setTimeout(stopPreview, AUTO_STOP_MS);
    };
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('error', () => {
      console.warn('[BrowseBeats] preview audio error');
      setPreviewingId(null);
    }, { once: true });
    setPreviewingId(beat.id);
  }

  function togglePreview(beat: Beat) {
    if (previewingId === beat.id) stopPreview();
    else startPreview(beat);
  }

  function clearFilters() {
    setQuery('');
    setBucket('all');
    setCategory('all');
  }

  function handleClose() {
    stopPreview();
    onClose();
  }

  function renderRow(beat: Beat) {
    const isSelected = beat.id === selectedId;
    const isPreviewing = previewingId === beat.id;
    return (
      <div
        key={beat.id}
        role="button"
        tabIndex={0}
        onClick={() => onChange(beat.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(beat.id); } }}
        aria-label={`${beat.title}, ${beat.bpm} BPM, ${beat.source === 'youtube' ? 'youtube' : beat.category}`}
        aria-current={isSelected ? 'true' : undefined}
        className={[
          'flex items-center gap-3 rounded-xl p-2 mb-1',
          isSelected ? 'bg-rhyme-yellow/16 outline outline-1 outline-rhyme-yellow' : 'bg-white/[0.03] hover:bg-white/[0.08]',
        ].join(' ')}
      >
        <div className="text-rhyme-yellow font-extrabold text-xl w-12 text-center leading-none">
          {Number.isInteger(beat.bpm) ? beat.bpm : beat.bpm.toFixed(1)}
          <small className="block text-[9px] text-white/40 mt-0.5">BPM</small>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{beat.title}</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wide">
            {beat.source === 'youtube' ? 'youtube' : beat.category}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); togglePreview(beat); }}
          aria-label={isPreviewing ? 'Stop preview' : 'Preview beat'}
          className={[
            'h-8 w-8 rounded-full text-xs flex items-center justify-center shrink-0',
            isPreviewing ? 'bg-rhyme-yellow text-bg' : 'bg-white/15 hover:bg-white/25',
          ].join(' ')}
        >
          {isPreviewing ? '▮▮' : '▶'}
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Browse beats"
      className="fixed inset-0 z-50 bg-bg text-white flex flex-col"
    >
      <div className="flex items-center px-4 pt-4">
        <strong className="text-lg">Browse beats</strong>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="ml-auto h-11 w-11 rounded-full bg-white/10 text-base flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      <div className="px-4 pt-3">
        <input
          type="search"
          placeholder="Search by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl bg-white/[0.06] px-3 py-2 text-sm placeholder:text-white/40 outline-none"
        />
      </div>

      <div className="px-4 pt-3 flex flex-wrap gap-2">
        {([
          ['all',  'All BPM'],
          ['slow', '<85'],
          ['mid',  '85-100'],
          ['fast', '>100'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setBucket(key)}
            aria-pressed={bucket === key}
            className={[
              'rounded-full px-3 py-1 text-xs font-bold',
              bucket === key ? 'bg-rhyme-yellow text-bg' : 'bg-white/[0.08] text-white',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory('all')}
          aria-pressed={category === 'all'}
          className={[
            'rounded-full px-3 py-1 text-[11px] font-semibold',
            category === 'all' ? 'bg-white/20 text-white' : 'bg-white/[0.04] text-white/50',
          ].join(' ')}
        >
          all categories
        </button>
        {cats.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            aria-pressed={category === cat}
            className={[
              'rounded-full px-3 py-1 text-[11px] font-semibold',
              category === cat ? 'bg-white/20 text-white' : 'bg-white/[0.04] text-white/50',
            ].join(' ')}
          >
            {cat === 'youtube' ? 'YouTube' : cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {beats.length === 0 ? (
          <p className="text-center text-white/60 mt-12">No beats added yet</p>
        ) : emptyAfterFilter ? (
          <div className="text-center mt-12">
            <p className="text-white/60">No beats match these filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-rhyme-yellow underline text-sm"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {recents.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">★ Recently played</div>
                {recents.map(renderRow)}
              </>
            )}
            <div className="text-[10px] uppercase tracking-wider text-white/40 mt-4 mb-2">All beats — sorted by BPM</div>
            {main.map(renderRow)}
          </>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-4 bg-bg/80 backdrop-blur-sm">
        <button
          type="button"
          onClick={handleClose}
          className="w-full rounded-2xl bg-rhyme-yellow text-bg font-extrabold py-3 text-base"
        >
          Done
        </button>
      </div>
    </div>
  );
}
