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

describe('logo.svg', () => {
  it('exists', () => {
    expect(existsSync(brand('logo.svg'))).toBe(true);
  });

  it('has the lockup viewBox 0 0 800 256', () => {
    const svg = readFileSync(brand('logo.svg'), 'utf8');
    expect(svg).toMatch(/viewBox\s*=\s*"0 0 800 256"/);
  });

  it('contains the wordmark inside a <text> element', () => {
    const svg = readFileSync(brand('logo.svg'), 'utf8');
    expect(svg).toMatch(/<text[^>]*>rhymefor\.fun<\/text>/);
  });

  it('embeds the icon mark geometry (both rings)', () => {
    const svg = readFileSync(brand('logo.svg'), 'utf8');
    // The mark's two ring centers, copied verbatim into the lockup.
    expect(svg).toMatch(/cx\s*=\s*"89"/);
    expect(svg).toMatch(/cx\s*=\s*"167"/);
    // The interlock arc, copied from mark.svg.
    expect(svg).toContain('M 142.46 178.31 A 56 56 0 0 0 117.55 154.30');
  });

  it('uses Manrope semibold for the wordmark', () => {
    const svg = readFileSync(brand('logo.svg'), 'utf8');
    expect(svg).toMatch(/font-family\s*=\s*"[^"]*Manrope/);
    expect(svg).toMatch(/font-weight\s*=\s*"600"/);
  });

  it('uses white for the wordmark fill', () => {
    const svg = readFileSync(brand('logo.svg'), 'utf8');
    // Look for fill="#ffffff" or fill="white" on the text element
    expect(svg).toMatch(/<text[^>]*fill\s*=\s*"(#ffffff|#FFFFFF|white)"/);
  });
});
