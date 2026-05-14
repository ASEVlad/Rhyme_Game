import { describe, it, expect } from 'vitest';
import { makeSessionTimer, type AudioLike } from './session-time';

function fakeAudio(initial: number, duration: number): AudioLike & { _t: number } {
  return { currentTime: initial, duration, _t: initial };
}

describe('makeSessionTimer', () => {
  it('returns audio.currentTime when no loops have happened', () => {
    const a = fakeAudio(0, 30);
    const sessionTime = makeSessionTimer(a);
    a.currentTime = 5;
    expect(sessionTime()).toBe(5);
    a.currentTime = 12.5;
    expect(sessionTime()).toBe(12.5);
  });

  it('detects a loop wraparound and adds duration', () => {
    const a = fakeAudio(0, 30);
    const sessionTime = makeSessionTimer(a);
    a.currentTime = 25;
    expect(sessionTime()).toBe(25);
    // looped back
    a.currentTime = 0.5;
    expect(sessionTime()).toBe(30 + 0.5);
  });

  it('handles multiple loops', () => {
    const a = fakeAudio(0, 10);
    const sessionTime = makeSessionTimer(a);
    a.currentTime = 9; sessionTime();
    a.currentTime = 0.1; sessionTime(); // 1st loop
    a.currentTime = 9.5; sessionTime();
    a.currentTime = 0.2; expect(sessionTime()).toBe(20.2); // 2nd loop
  });

  it('does not flag tiny dips as loops', () => {
    const a = fakeAudio(0, 30);
    const sessionTime = makeSessionTimer(a);
    a.currentTime = 12.3; sessionTime();
    a.currentTime = 12.299; // jitter
    expect(sessionTime()).toBe(12.299); // no loop added
  });

  it('holds session time at 0 during the silent prefix when startOffset is set', () => {
    const a = fakeAudio(0, 30);
    const sessionTime = makeSessionTimer(a, 0.5);
    a.currentTime = 0.3; // still in the silent prefix
    expect(sessionTime()).toBe(0); // clamped
  });

  it('counts from 0 once currentTime exceeds startOffset', () => {
    const a = fakeAudio(0, 30);
    const sessionTime = makeSessionTimer(a, 0.5);
    a.currentTime = 0.8;
    expect(sessionTime()).toBeCloseTo(0.3);
  });
});
