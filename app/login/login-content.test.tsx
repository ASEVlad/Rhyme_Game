import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginContent } from './login-content';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    <a href={href} {...rest}>{children}</a>,
}));

describe('LoginContent', () => {
  it('renders branding column elements', () => {
    render(<LoginContent />);
    expect(screen.getByText('Freestyle rap trainer')).toBeInTheDocument();
    expect(screen.getByText('Calm Bap · 88 BPM')).toBeInTheDocument();
  });

  it('renders the auth card with Google sign-in', () => {
    render(<LoginContent />);
    // The "Sign in" heading is an h1; disambiguate from the form button.
    expect(screen.getByRole('heading', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('renders the wordmark as a link to /', () => {
    render(<LoginContent />);
    const wordmark = screen.getByText('THE RHYME GAME');
    expect(wordmark.tagName).toBe('A');
    expect(wordmark).toHaveAttribute('href', '/');
  });

  it('renders the email sign-in form (always)', () => {
    render(<LoginContent />);
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('renders the waitlist form', () => {
    render(<LoginContent />);
    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
  });

  it('does not render the dev-login form', () => {
    render(<LoginContent />);
    expect(screen.queryByText(/dev login/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in \(dev\)/i })).not.toBeInTheDocument();
  });
});
