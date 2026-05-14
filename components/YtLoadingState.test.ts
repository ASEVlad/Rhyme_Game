// components/YtLoadingState.test.ts
import { describe, it, expect } from 'vitest';
import { getActiveStage } from './YtLoadingState';

describe('getActiveStage', () => {
  it('returns 1 at 0 ms — URL validated is immediately done, audio download starts', () => {
    expect(getActiveStage(0)).toBe(1);
  });

  it('returns 1 just before 12 s', () => {
    expect(getActiveStage(11_999)).toBe(1);
  });

  it('returns 2 at exactly 12 s', () => {
    expect(getActiveStage(12_000)).toBe(2);
  });

  it('returns 2 just before 20 s', () => {
    expect(getActiveStage(19_999)).toBe(2);
  });

  it('returns 3 at exactly 20 s', () => {
    expect(getActiveStage(20_000)).toBe(3);
  });

  it('returns 3 beyond 20 s', () => {
    expect(getActiveStage(60_000)).toBe(3);
  });
});
