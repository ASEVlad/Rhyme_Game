import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Beat } from '@/lib/beats';

const startPreviewMock = vi.fn();
let previewingIdValue: string | null = null;

vi.mock('@/hooks/useBeatPreview', () => ({
  useBeatPreview: () => ({
    previewingId: previewingIdValue,
    startPreview: startPreviewMock,
    togglePreview: vi.fn(),
    stopPreview: vi.fn(),
  }),
  PREVIEW_START_SEC: 15,
  PREVIEW_DURATION_MS: 15000,
}));

vi.mock('@/lib/beats', async () => {
  const mod = await vi.importActual<typeof import('@/lib/beats')>('@/lib/beats');
  const BEATS: Beat[] = [
    { id: 'b1', src: '/b1.mp3', title: 'Beat One', bpm: 80, barsPerLoop: 8, category: 'boom-bap' },
    { id: 'b2', src: '/b2.mp3', title: 'Beat Two', bpm: 95, barsPerLoop: 8, category: 'trap' },
  ];
  return { ...mod, BEATS, pickBeat: (id: string) => BEATS.find(b => b.id === id) };
});

vi.mock('@/lib/language-storage', () => ({
  loadLanguage: () => 'en',
  saveLanguage: () => {},
}));

beforeEach(() => {
  startPreviewMock.mockReset();
  previewingIdValue = null;
  (global as any).fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => [] });
});

import { Setup } from './Setup';

describe('Setup — desktop inline beat list', () => {
  it('clicking a beat row calls startPreview', () => {
    render(
      <Setup
        initialBeatId={null}
        initialLanguageId="en"
        onPlay={() => {}}
        onLogout={() => {}}
      />,
    );
    const list = screen.getByTestId('desktop-beat-list');
    fireEvent.click(within(list).getByRole('button', { name: /Beat Two/i }));
    expect(startPreviewMock).toHaveBeenCalled();
    expect(startPreviewMock.mock.calls[0][0].id).toBe('b2');
  });

  it('renders the ▮▮ now-playing indicator on the previewing row', () => {
    previewingIdValue = 'b1';
    render(
      <Setup
        initialBeatId={null}
        initialLanguageId="en"
        onPlay={() => {}}
        onLogout={() => {}}
      />,
    );
    const list = screen.getByTestId('desktop-beat-list');
    const row = within(list).getByRole('button', { name: /Beat One/i });
    expect(within(row).getByText('▮▮')).toBeInTheDocument();
    const otherRow = within(list).getByRole('button', { name: /Beat Two/i });
    expect(within(otherRow).queryByText('▮▮')).not.toBeInTheDocument();
  });
});
