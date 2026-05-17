import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClosedBeta } from './closed-beta';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    <a href={href} {...rest}>{children}</a>,
}));

describe('ClosedBeta', () => {
  it('renders the small brand wordmark at the top as a link to /', () => {
    render(<ClosedBeta />);
    const wordmark = screen.getByText('THE RHYME GAME');
    expect(wordmark.tagName).toBe('A');
    expect(wordmark).toHaveAttribute('href', '/');
  });

  it('renders the oversized brand title (h1) in the middle zone', () => {
    render(<ClosedBeta />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent?.replace(/\s+/g, ' ').trim()).toMatch(/the rhyme game/i);
  });

  it('renders the Closed beta caption inside the card', () => {
    render(<ClosedBeta />);
    expect(screen.getByText(/closed beta — private testing/i)).toBeInTheDocument();
  });

  it('renders the waitlist form always-expanded as the primary action', () => {
    render(<ClosedBeta />);
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
    expect(screen.getByText(/get notified when we open up/i)).toBeInTheDocument();
  });

  it('does NOT render a Google sign-in button', () => {
    render(<ClosedBeta />);
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
  });

  it('renders the back-to-home link outside the card', () => {
    render(<ClosedBeta />);
    const back = screen.getByText(/back to home/i);
    expect(back.closest('a')).toHaveAttribute('href', '/');
  });
});
