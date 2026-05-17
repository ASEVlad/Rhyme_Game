import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginContent } from './login-content';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    <a href={href} {...rest}>{children}</a>,
}));

describe('LoginContent', () => {
  it('renders the small brand wordmark at the top as a link to /', () => {
    render(<LoginContent />);
    const wordmark = screen.getByText('THE RHYME GAME');
    expect(wordmark.tagName).toBe('A');
    expect(wordmark).toHaveAttribute('href', '/');
  });

  it('renders the oversized brand title (h1) in the middle zone', () => {
    render(<LoginContent />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent?.replace(/\s+/g, ' ').trim()).toMatch(/the rhyme game/i);
  });

  it('renders the 4-dot rhythm motif', () => {
    const { container } = render(<LoginContent />);
    const dots = container.querySelectorAll('[data-rhythm-dot]');
    expect(dots).toHaveLength(4);
  });

  it('renders the auth card with Sign in heading and Continue with Google', () => {
    render(<LoginContent />);
    expect(screen.getByRole('heading', { level: 2, name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('always renders the inline email form with its caption', () => {
    render(<LoginContent />);
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByText(/or use email/i)).toBeInTheDocument();
  });

  it('shows the waitlist as a collapsed text link by default', () => {
    render(<LoginContent />);
    expect(screen.getByRole('button', { name: /not invited\? join the waitlist/i })).toBeInTheDocument();
    // The actual waitlist form (with its own Join waitlist submit button) is not yet mounted
    expect(screen.queryByRole('button', { name: /^join waitlist$/i })).not.toBeInTheDocument();
  });

  it('expands the waitlist form when the text link is clicked', () => {
    render(<LoginContent />);
    fireEvent.click(screen.getByRole('button', { name: /not invited\? join the waitlist/i }));
    expect(screen.getByRole('button', { name: /^join waitlist$/i })).toBeInTheDocument();
  });

  it('renders the back-to-home link', () => {
    render(<LoginContent />);
    const back = screen.getByText(/back to home/i);
    expect(back.closest('a')).toHaveAttribute('href', '/');
  });

  it('does not show an OAuth error message by default', () => {
    render(<LoginContent />);
    expect(screen.queryByText(/sign-in failed/i)).not.toBeInTheDocument();
  });
});
