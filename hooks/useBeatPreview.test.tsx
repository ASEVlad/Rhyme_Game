import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBeatPreview } from './useBeatPreview';
import type { Beat } from '@/lib/beats';

const beat1: Beat = { id: 'b1', src: '/b1.mp3', title: 'B1', bpm: 90, barsPerLoop: 8, category: 'boom-bap' };
const beat2: Beat = { id: 'b2', src: '/b2.mp3', title: 'B2', bpm: 95, barsPerLoop: 8, category: 'trap' };

let audioInstance: HTMLAudioElement;
let playMock: ReturnType<typeof vi.fn>;
let pauseMock: ReturnType<typeof vi.fn>;
let mockDuration = 60;

beforeEach(() => {
  mockDuration = 60;
  vi.stubGlobal('Audio', vi.fn(() => {
    audioInstance = document.createElement('audio');
    playMock = vi.fn().mockResolvedValue(undefined);
    pauseMock = vi.fn();
    audioInstance.play = playMock as unknown as HTMLAudioElement['play'];
    audioInstance.pause = pauseMock as unknown as HTMLAudioElement['pause'];
    Object.defineProperty(audioInstance, 'duration', { get: () => mockDuration });
    return audioInstance;
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useBeatPreview', () => {
  it('startPreview sets previewingId synchronously', () => {
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    expect(result.current.previewingId).toBe('b1');
  });

  it('on loadedmetadata sets currentTime to 15 and calls play (duration ≥ 16)', () => {
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    act(() => { audioInstance.dispatchEvent(new Event('loadedmetadata')); });
    expect(audioInstance.currentTime).toBe(15);
    expect(playMock).toHaveBeenCalledOnce();
  });

  it('clamps currentTime to duration - 1 when duration < 16', () => {
    mockDuration = 8;
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    act(() => { audioInstance.dispatchEvent(new Event('loadedmetadata')); });
    expect(audioInstance.currentTime).toBe(7);
  });

  it('auto-stops after 15s of fake time', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    act(() => { audioInstance.dispatchEvent(new Event('loadedmetadata')); });
    expect(result.current.previewingId).toBe('b1');
    act(() => { vi.advanceTimersByTime(15000); });
    expect(result.current.previewingId).toBe(null);
    expect(pauseMock).toHaveBeenCalled();
  });

  it('swap startPreview discards the old audio and listens on a fresh one', () => {
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    const firstAudio = audioInstance;
    const firstPlayMock = playMock;
    act(() => { result.current.startPreview(beat2); });
    // Each preview gets its own Audio instance — old element is detached.
    expect(audioInstance).not.toBe(firstAudio);
    // Stale loadedmetadata on the discarded element does nothing.
    act(() => { firstAudio.dispatchEvent(new Event('loadedmetadata')); });
    expect(firstPlayMock).not.toHaveBeenCalled();
    // The new element's loadedmetadata triggers play once.
    act(() => { audioInstance.dispatchEvent(new Event('loadedmetadata')); });
    expect(playMock).toHaveBeenCalledOnce();
    expect(result.current.previewingId).toBe('b2');
  });

  it('togglePreview stops when called on currently previewing beat', () => {
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.togglePreview(beat1); });
    expect(result.current.previewingId).toBe('b1');
    act(() => { result.current.togglePreview(beat1); });
    expect(result.current.previewingId).toBe(null);
  });

  it('togglePreview switches when called on a different beat', () => {
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.togglePreview(beat1); });
    act(() => { result.current.togglePreview(beat2); });
    expect(result.current.previewingId).toBe('b2');
  });

  it('unmount cleanup pauses audio and clears any pending timer', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    act(() => { audioInstance.dispatchEvent(new Event('loadedmetadata')); });
    unmount();
    expect(pauseMock).toHaveBeenCalled();
    pauseMock.mockClear();
    act(() => { vi.advanceTimersByTime(16000); });
    expect(pauseMock).not.toHaveBeenCalled();
  });
});
