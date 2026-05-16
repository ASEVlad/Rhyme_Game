import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn } from 'next-auth/react';
import { EmailSignInForm } from './email-signin-form';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));

describe('EmailSignInForm', () => {
  beforeEach(() => {
    (signIn as ReturnType<typeof vi.fn>).mockReset();
  });

  it('renders the input, label, and submit button', () => {
    render(<EmailSignInForm />);
    expect(screen.getByText(/sign in with your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send sign-in link/i }),
    ).toBeInTheDocument();
  });

  it('marks the input as required', () => {
    render(<EmailSignInForm />);
    expect(screen.getByPlaceholderText('your@email.com')).toBeRequired();
  });

  it('disables submit until the user types', () => {
    render(<EmailSignInForm />);
    const btn = screen.getByRole('button', { name: /send sign-in link/i });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    expect(btn).not.toBeDisabled();
  });

  it('calls signIn("resend", …) with the typed email on submit', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith('resend', {
      email: 'me@example.com',
      redirect: false,
      callbackUrl: '/play',
    });
  });

  it('shows "Sending…" while the signIn promise is pending', async () => {
    let resolveCall!: (v: unknown) => void;
    (signIn as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(resolve => {
        resolveCall = resolve;
      }),
    );
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sending…/i })).toBeDisabled(),
    );

    resolveCall({ error: null });
  });

  it('replaces the form with an inbox message on success', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument(),
    );
    expect(screen.queryByPlaceholderText('your@email.com')).not.toBeInTheDocument();
    expect(screen.getByText(/me@example\.com/)).toBeInTheDocument();
  });

  it('shows the generic error message when signIn returns an error', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'OAuthSignin' });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument(),
    );
    // form is still rendered for retry
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
  });

  it('shows the generic error message when signIn rejects', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument(),
    );
  });

  it('clears the error microcopy when the user edits the input again', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'OAuthSignin' });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me2@example.com' },
    });
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
