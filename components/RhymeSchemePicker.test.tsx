// components/RhymeSchemePicker.test.tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RhymeSchemePicker } from './RhymeSchemePicker';
import type { RhymeSchemeId } from '@/lib/rhyme-schemes';

type MinimalScheme = { id: RhymeSchemeId; label: string; wordsPerGroup: number | null; groupCount: number; interleave: boolean };

const SCHEMES: readonly MinimalScheme[] = [
  { id: 'free',        label: 'Free',        wordsPerGroup: null, groupCount: 10, interleave: false },
  { id: 'couplets',    label: 'Couplets',    wordsPerGroup: 2,    groupCount: 16, interleave: false },
  { id: 'bar4',        label: '4-bar',       wordsPerGroup: 4,    groupCount: 8,  interleave: false },
  { id: 'alternating', label: 'Alternating', wordsPerGroup: 2,    groupCount: 16, interleave: true  },
];

const SELECTED: RhymeSchemeId = 'free'; // the active item

describe('RhymeSchemePicker', () => {
  it('renders all scheme buttons', () => {
    render(
      <RhymeSchemePicker
        schemes={SCHEMES}
        selectedId={SELECTED}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole('radio', { name: 'Free' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Couplets' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '4-bar' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alternating' })).toBeInTheDocument();
  });

  it('active button gets default active class', () => {
    render(
      <RhymeSchemePicker
        schemes={SCHEMES}
        selectedId={SELECTED}
        onChange={() => {}}
      />
    );
    const activeBtn = screen.getByRole('radio', { name: 'Free' });
    expect(activeBtn).toHaveClass('text-rhyme-yellow');
  });

  it('inactive button gets default inactive class', () => {
    render(
      <RhymeSchemePicker
        schemes={SCHEMES}
        selectedId={SELECTED}
        onChange={() => {}}
      />
    );
    const inactiveBtn = screen.getByRole('radio', { name: 'Couplets' });
    expect(inactiveBtn).toHaveClass('text-white/40');
  });

  it('applies custom className to container', () => {
    const { container } = render(
      <RhymeSchemePicker schemes={SCHEMES} selectedId={SELECTED} onChange={() => {}} className="custom-container" />
    );
    expect(container.firstChild).toHaveClass('custom-container');
  });

  it('applies custom activeClassName to active button', () => {
    render(<RhymeSchemePicker schemes={SCHEMES} selectedId={SELECTED} onChange={() => {}} activeClassName="active-override" />);
    expect(screen.getByRole('radio', { name: 'Free' })).toHaveClass('active-override');
  });

  it('applies custom inactiveClassName to inactive buttons', () => {
    render(<RhymeSchemePicker schemes={SCHEMES} selectedId={SELECTED} onChange={() => {}} inactiveClassName="inactive-override" />);
    expect(screen.getByRole('radio', { name: 'Couplets' })).toHaveClass('inactive-override');
  });
});
