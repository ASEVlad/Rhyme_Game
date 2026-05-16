import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClosedBeta } from './closed-beta';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    <a href={href} {...rest}>{children}</a>,
}));

describe('ClosedBeta', () => {
  it('renders the wordmark as a link to /', () => {
    render(<ClosedBeta />);
    const wordmark = screen.getByText('THE RHYME GAME');
    expect(wordmark.tagName).toBe('A');
    expect(wordmark).toHaveAttribute('href', '/');
  });

  it('keeps the closed-beta heading and invite-link copy', () => {
    render(<ClosedBeta />);
    expect(screen.getByText('Closed beta')).toBeInTheDocument();
    expect(screen.getByText(/ask your friend for an invite link/i)).toBeInTheDocument();
  });

  it('renders the waitlist form', () => {
    render(<ClosedBeta />);
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
    expect(screen.getByText(/get notified when we open up/i)).toBeInTheDocument();
  });
});
