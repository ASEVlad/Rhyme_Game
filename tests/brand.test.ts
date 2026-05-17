import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const brand = (p: string) => resolve(root, 'public', 'brand', p);

describe('mark.svg', () => {
  it('exists', () => {
    expect(existsSync(brand('mark.svg'))).toBe(true);
  });

  it('has a square 256×256 viewBox', () => {
    const svg = readFileSync(brand('mark.svg'), 'utf8');
    expect(svg).toMatch(/viewBox\s*=\s*"0 0 256 256"/);
  });

  it('contains both rings as circles', () => {
    const svg = readFileSync(brand('mark.svg'), 'utf8');
    // Ring A (left) center
    expect(svg).toMatch(/cx\s*=\s*"89"/);
    // Ring B (right) center
    expect(svg).toMatch(/cx\s*=\s*"167"/);
    // Same vertical center
    expect(svg.match(/cy\s*=\s*"128"/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('uses the chrome gradient with the Tailwind cyan tokens', () => {
    const svg = readFileSync(brand('mark.svg'), 'utf8');
    expect(svg.toLowerCase()).toContain('#5ec8ff');
    expect(svg.toLowerCase()).toContain('#2860e0');
  });
});
