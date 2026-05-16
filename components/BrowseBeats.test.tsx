import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Beat } from '@/lib/beats';

const startPreviewMock = vi.fn();
const togglePreviewMock = vi.fn();
const stopPreviewMock = vi.fn();
let previewingIdValue: string | null = null;

vi.mock('@/hooks/useBeatPreview', () => ({
  useBeatPreview: () => ({
    previewingId: previewingIdValue,
    startPreview: startPreviewMock,
    togglePreview: togglePreviewMock,
    stopPreview: stopPreviewMock,
  }),
  PREVIEW_START_SEC: 15,
  PREVIEW_DURATION_MS: 15000,
}));

vi.mock('@/lib/recent-beats', () => ({
  loadRecentBeats: () => [],
}));

import { BrowseBeats } from './BrowseBeats';

const beats: Beat[] = [
  { id: 'b1', src: '/b1.mp3', title: 'Beat One', bpm: 80, barsPerLoop: 8, category: 'boom-bap' },
  { id: 'b2', src: '/b2.mp3', title: 'Beat Two', bpm: 92, barsPerLoop: 8, category: 'trap' },
  { id: 'b3', src: '/b3.mp3', title: 'Beat Three', bpm: 105, barsPerLoop: 8, category: 'drill' },
];

const noop = () => {};

beforeEach(() => {
  startPreviewMock.mockReset();
  togglePreviewMock.mockReset();
  stopPreviewMock.mockReset();
  previewingIdValue = null;
});

describe('BrowseBeats — click-to-preview', () => {
  it('clicking a row calls onChange and startPreview with the same beat', () => {
    const onChange = vi.fn();
    render(<BrowseBeats beats={beats} selectedId={null} onChange={onChange} onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Beat One, 80 BPM/i }));
    expect(onChange).toHaveBeenCalledWith('b1');
    expect(startPreviewMock).toHaveBeenCalledWith(beats[0]);
  });

  it('clicking the preview ▶ button calls togglePreview without changing selection', () => {
    const onChange = vi.fn();
    render(<BrowseBeats beats={beats} selectedId={null} onChange={onChange} onClose={noop} />);
    const previewButtons = screen.getAllByRole('button', { name: 'Preview beat' });
    fireEvent.click(previewButtons[0]);
    expect(togglePreviewMock).toHaveBeenCalled();
    expect(beats).toContain(togglePreviewMock.mock.calls[0][0]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('close handler stops preview', () => {
    const onClose = vi.fn();
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(stopPreviewMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('BrowseBeats — filters & rendering', () => {
  it('renders all beats when no filters are applied', () => {
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={noop} />);
    expect(screen.getByText('Beat One')).toBeInTheDocument();
    expect(screen.getByText('Beat Two')).toBeInTheDocument();
    expect(screen.getByText('Beat Three')).toBeInTheDocument();
  });

  it('search input filters by title (case-insensitive substring)', () => {
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={noop} />);
    fireEvent.change(screen.getByPlaceholderText(/Search by title/i), { target: { value: 'three' } });
    expect(screen.queryByText('Beat One')).not.toBeInTheDocument();
    expect(screen.getByText('Beat Three')).toBeInTheDocument();
  });

  it('BPM bucket chip filters out non-matching beats', () => {
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: '<85' }));
    expect(screen.getByText('Beat One')).toBeInTheDocument();
    expect(screen.queryByText('Beat Two')).not.toBeInTheDocument();
    expect(screen.queryByText('Beat Three')).not.toBeInTheDocument();
  });

  it('shows empty-state message and a Clear filters action when filters exclude everything', () => {
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={noop} />);
    fireEvent.change(screen.getByPlaceholderText(/Search by title/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/No beats match/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }));
    expect(screen.getByText('Beat One')).toBeInTheDocument();
  });
});

describe('BrowseBeats — keyboard', () => {
  it('Escape closes the modal', () => {
    const onClose = vi.fn();
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
