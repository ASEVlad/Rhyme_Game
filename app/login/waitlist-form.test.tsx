import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WaitlistForm } from './waitlist-form';

describe('WaitlistForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the label and email input', () => {
    render(<WaitlistForm label="Get notified when we open up" />);
    expect(screen.getByText('Get notified when we open up')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
  });

  it('marks the input as required', () => {
    render(<WaitlistForm label="x" />);
    expect(screen.getByPlaceholderText('your@email.com')).toBeRequired();
  });

  it('posts to /api/waitlist and shows success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    render(<WaitlistForm label="x" />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'joiner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /join waitlist/i }));

    await waitFor(() => expect(screen.getByText(/you're on the list/i)).toBeInTheDocument());

    expect(fetch).toHaveBeenCalledWith('/api/waitlist', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email: 'joiner@example.com' }),
    }));
  });

  it('shows an error message on 400', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_email' }),
    });
    render(<WaitlistForm label="x" />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'bogus@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /join waitlist/i }));

    await waitFor(() =>
      expect(screen.getByText(/doesn't look like a valid email/i)).toBeInTheDocument(),
    );
    // form is still rendered so the user can correct and retry
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
  });

  it('shows a generic error on network failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    render(<WaitlistForm label="x" />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'joiner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /join waitlist/i }));

    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument(),
    );
  });
});
