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
    render(<LoginContent emailEnabled={false} />);
    expect(screen.getByText('Freestyle rap trainer')).toBeInTheDocument();
    expect(screen.getByText('Calm Bap · 88 BPM')).toBeInTheDocument();
  });

  it('renders the auth card with Google sign-in', () => {
    render(<LoginContent emailEnabled={false} />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('renders the wordmark as a link to /', () => {
    render(<LoginContent emailEnabled={false} />);
    const wordmark = screen.getByText('THE RHYME GAME');
    expect(wordmark.tagName).toBe('A');
    expect(wordmark).toHaveAttribute('href', '/');
  });

  it('renders the waitlist form regardless of emailEnabled', () => {
    render(<LoginContent emailEnabled={false} />);
    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
  });

  it('hides the email sign-in form when emailEnabled is false', () => {
    render(<LoginContent emailEnabled={false} />);
    expect(
      screen.queryByRole('button', { name: /send sign-in link/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the email sign-in form when emailEnabled is true', () => {
    render(<LoginContent emailEnabled={true} />);
    expect(
      screen.getByRole('button', { name: /send sign-in link/i }),
    ).toBeInTheDocument();
    // Both forms coexist
    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('does not render the dev-login form', () => {
    render(<LoginContent emailEnabled={false} />);
    expect(screen.queryByText(/dev login/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in \(dev\)/i })).not.toBeInTheDocument();
  });
});
