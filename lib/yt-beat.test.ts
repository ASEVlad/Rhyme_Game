import { describe, it, expect } from 'vitest';
import { isYouTubeUrl, hashUrl } from './yt-beat';

describe('isYouTubeUrl', () => {
  it('accepts youtube.com/watch URL', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });
  it('accepts youtu.be short link', () => {
    expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  });
  it('rejects Vimeo URL', () => {
    expect(isYouTubeUrl('https://vimeo.com/123')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isYouTubeUrl('')).toBe(false);
  });
  it('rejects plain text', () => {
    expect(isYouTubeUrl('not a url')).toBe(false);
  });
  it('rejects youtu.be with no video id', () => {
    expect(isYouTubeUrl('https://youtu.be/')).toBe(false);
  });
  it('rejects malformed v param prefix', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?xv=abc')).toBe(false);
  });
});

describe('hashUrl', () => {
  it('returns exactly 12 lowercase hex chars', () => {
    const h = hashUrl('https://youtu.be/test');
    expect(h).toHaveLength(12);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });
  it('is deterministic', () => {
    expect(hashUrl('https://youtu.be/test')).toBe(hashUrl('https://youtu.be/test'));
  });
  it('differs for different URLs', () => {
    expect(hashUrl('https://youtu.be/aaa')).not.toBe(hashUrl('https://youtu.be/bbb'));
  });
});

