// components/DifficultyPicker.test.tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DifficultyPicker } from './DifficultyPicker';
import type { DifficultyId } from '@/lib/difficulties';

type MinimalDifficulty = { id: DifficultyId; label: string; promptHint: string };

const DIFFICULTIES: readonly MinimalDifficulty[] = [
  { id: 'beginner',     label: 'Easy',   promptHint: '' },
  { id: 'intermediate', label: 'Medium', promptHint: '' },
  { id: 'advanced',     label: 'Hard',   promptHint: '' },
];

const SELECTED: DifficultyId = 'beginner'; // the "easy" item

describe('DifficultyPicker', () => {
  it('renders all difficulty buttons', () => {
    render(
      <DifficultyPicker
        difficulties={DIFFICULTIES}
        selectedId={SELECTED}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole('radio', { name: 'Easy' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Hard' })).toBeInTheDocument();
  });

  it('active button gets default active class', () => {
    render(
      <DifficultyPicker
        difficulties={DIFFICULTIES}
        selectedId={SELECTED}
        onChange={() => {}}
      />
    );
    const activeBtn = screen.getByRole('radio', { name: 'Easy' });
    expect(activeBtn).toHaveClass('text-rhyme-yellow');
  });

  it('inactive button gets default inactive class', () => {
    render(
      <DifficultyPicker
        difficulties={DIFFICULTIES}
        selectedId={SELECTED}
        onChange={() => {}}
      />
    );
    const inactiveBtn = screen.getByRole('radio', { name: 'Medium' });
    expect(inactiveBtn).toHaveClass('text-white/40');
  });

  it('applies custom className to container', () => {
    const { container } = render(
      <DifficultyPicker difficulties={DIFFICULTIES} selectedId={SELECTED} onChange={() => {}} className="custom-container" />
    );
    expect(container.firstChild).toHaveClass('custom-container');
  });

  it('applies custom activeClassName to active button', () => {
    render(<DifficultyPicker difficulties={DIFFICULTIES} selectedId={SELECTED} onChange={() => {}} activeClassName="active-override" />);
    expect(screen.getByRole('radio', { name: 'Easy' })).toHaveClass('active-override');
  });

  it('applies custom inactiveClassName to inactive buttons', () => {
    render(<DifficultyPicker difficulties={DIFFICULTIES} selectedId={SELECTED} onChange={() => {}} inactiveClassName="inactive-override" />);
    expect(screen.getByRole('radio', { name: 'Medium' })).toHaveClass('inactive-override');
  });
});
