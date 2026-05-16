// components/BrowseBeats.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Beat } from '@/lib/beats';
import {
  buildSectionLists, availableCategories,
  type BpmBucket, type CategoryChip,
} from '@/lib/beat-filters';
import { loadRecentBeats } from '@/lib/recent-beats';
import { useBeatPreview } from '@/hooks/useBeatPreview';

export function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

type Props = {
  beats: Beat[];                       // typically allBeats = [...BEATS, ...ytCatalog]
  selectedId: string | null;
  onChange: (id: string) => void;
  onClose: () => void;
};

export function BrowseBeats({ beats, selectedId, onChange, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<BpmBucket>('all');
  const [category, setCategory] = useState<CategoryChip | 'all'>('all');
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const { previewingId, startPreview, togglePreview, stopPreview } = useBeatPreview();

  // Read recents after mount (avoid SSR/hydration mismatch).
  useEffect(() => { setRecentIds(loadRecentBeats()); }, []);

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  // Esc closes the modal; Tab is trapped inside.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(el => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { recents, main, emptyAfterFilter } = useMemo(
    () => buildSectionLists(beats, recentIds, { bucket, category, query }),
    [beats, recentIds, bucket, category, query],
  );
  const randomPool = useMemo(() => [...recents, ...main], [recents, main]);
  const cats = useMemo(() => availableCategories(beats), [beats]);

  function handleRandomPick() {
    const beat = pickRandom(randomPool);
    if (!beat) return;
    onChange(beat.id);
    startPreview(beat);
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
        onClick={() => { onChange(beat.id); startPreview(beat); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(beat.id);
            startPreview(beat);
          }
        }}
        aria-label={`${beat.title}, ${beat.bpm} BPM, ${beat.source === 'youtube' ? 'youtube' : beat.category}`}
        aria-current={isSelected ? 'true' : undefined}
        className={[
          'flex items-center gap-3 rounded-xl p-2 mb-1',
          isSelected
            ? 'bg-[rgba(94,200,255,0.12)] border border-[rgba(94,200,255,0.25)]'
            : 'bg-[rgba(94,200,255,0.04)] hover:bg-[rgba(94,200,255,0.08)]',
        ].join(' ')}
      >
        <div className="text-[#5ec8ff] font-extrabold text-xl w-12 text-center leading-none">
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
            isPreviewing ? 'text-[#060c14]' : 'bg-[rgba(94,200,255,0.10)] hover:bg-[rgba(94,200,255,0.18)]',
          ].join(' ')}
          style={isPreviewing ? { background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' } : undefined}
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
      className="bg-[#060c14] text-white flex flex-col h-full"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      <div className="flex items-center px-4 pt-4">
        <strong className="text-lg">Browse beats</strong>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleRandomPick}
            aria-label="Pick a random beat"
            disabled={randomPool.length === 0}
            className="h-11 w-11 rounded-full bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)] text-base flex items-center justify-center disabled:opacity-40"
          >
            🎲
          </button>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="h-11 w-11 rounded-full bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)] text-base flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <input
          type="search"
          placeholder="Search by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl bg-[rgba(94,200,255,0.06)] border border-[rgba(94,200,255,0.30)] px-3 py-2 text-sm placeholder:text-white/40 outline-none"
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
              bucket === key ? 'text-[#060c14]' : 'bg-[rgba(94,200,255,0.06)] text-white/70',
            ].join(' ')}
            style={bucket === key ? { background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' } : undefined}
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
            category === 'all' ? 'bg-[rgba(94,200,255,0.18)] text-white' : 'bg-[rgba(94,200,255,0.04)] text-white/50',
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
              category === cat ? 'bg-[rgba(94,200,255,0.18)] text-white' : 'bg-[rgba(94,200,255,0.04)] text-white/50',
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
              className="mt-3 text-[#5ec8ff] underline text-sm"
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
            {main.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mt-4 mb-2">All beats — sorted by BPM</div>
                {main.map(renderRow)}
              </>
            )}
          </>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-4 bg-[#060c14]/80 backdrop-blur-sm">
        <button
          type="button"
          onClick={handleClose}
          className="w-full rounded-2xl text-[#060c14] font-extrabold py-3 text-base"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', boxShadow: '0 0 24px rgba(94,200,255,0.45)' }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
