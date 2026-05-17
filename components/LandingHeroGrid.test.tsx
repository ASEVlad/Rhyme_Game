import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LandingHeroGrid } from './LandingHeroGrid';

describe('LandingHeroGrid', () => {
  it('renders the four default target words in the rightmost column', () => {
    const { container } = render(<LandingHeroGrid />);
    const rows = container.querySelectorAll('[data-row]');
    expect(rows).toHaveLength(4);

    const expected = ['moon', 'soon', 'spree', 'free'];
    rows.forEach((row, i) => {
      const target = row.querySelector('[data-cell="target"]');
      expect(target).not.toBeNull();
      expect(target!.textContent).toBe(expected[i]);
    });
  });

  it('renders the ball in the active row (row index 1), column 2', () => {
    const { container } = render(<LandingHeroGrid />);
    const ball = container.querySelector('[data-ball]');
    expect(ball).not.toBeNull();
    const parentCell = ball!.closest('[data-cell]')!;
    expect(parentCell.getAttribute('data-col')).toBe('2');
    expect(parentCell.closest('[data-row]')!.getAttribute('data-row')).toBe('1');
  });

  it('applies the documented row opacities (0.4 / 1.0 / 0.55 / 0.25)', () => {
    const { container } = render(<LandingHeroGrid />);
    const opacities = Array.from(container.querySelectorAll('[data-row]'))
      .map(row => (row as HTMLElement).style.opacity);
    expect(opacities).toEqual(['0.4', '1', '0.55', '0.25']);
  });

  it('accepts a custom targets prop', () => {
    render(<LandingHeroGrid targets={['rain', 'pain', 'flame', 'name']} />);
    expect(screen.getByText('rain')).toBeInTheDocument();
    expect(screen.getByText('pain')).toBeInTheDocument();
    expect(screen.getByText('flame')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
  });
});
