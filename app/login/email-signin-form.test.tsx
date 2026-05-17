import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn } from 'next-auth/react';
import { EmailSignInForm } from './email-signin-form';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));

const assignMock = vi.fn();

beforeEach(() => {
  (signIn as ReturnType<typeof vi.fn>).mockReset();
  assignMock.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...window.location, assign: assignMock },
  });
});

describe('EmailSignInForm', () => {
  it('renders the email input, label, and Sign in button', () => {
    render(<EmailSignInForm />);
    expect(screen.getByText(/sign in with your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('marks the input as required', () => {
    render(<EmailSignInForm />);
    expect(screen.getByPlaceholderText('your@email.com')).toBeRequired();
  });

  it('disables submit until the user types', () => {
    render(<EmailSignInForm />);
    const btn = screen.getByRole('button', { name: /^sign in$/i });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    expect(btn).not.toBeDisabled();
  });

  it('calls signIn("credentials", …) with the typed email on submit', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      error: undefined,
      url: '/play',
    });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith('credentials', {
      email: 'me@example.com',
      redirect: false,
      callbackUrl: '/play',
    });
  });

  it('navigates to the returned url on success', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      error: undefined,
      url: '/play',
    });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/play'));
  });

  it('shows "Signing in…" while the signIn promise is pending', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /signing in…/i })).toBeDisabled(),
    );

    await act(async () => {
      resolveCall({ ok: true, error: undefined, url: '/play' });
    });
  });

  it('shows "not accepted yet" when signIn returns an error', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: 'CredentialsSignin',
    });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(screen.getByText(/account isn't accepted yet/i)).toBeInTheDocument(),
    );
    // Form remains for retry.
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    // We did NOT navigate.
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('shows "not accepted yet" when signIn rejects', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(screen.getByText(/account isn't accepted yet/i)).toBeInTheDocument(),
    );
  });

  it('clears the error microcopy when the user edits the input again', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: 'CredentialsSignin',
    });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(screen.getByText(/account isn't accepted yet/i)).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me2@example.com' },
    });
    expect(screen.queryByText(/account isn't accepted yet/i)).not.toBeInTheDocument();
  });
});
