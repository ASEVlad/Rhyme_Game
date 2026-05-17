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

describe('logo-mono.svg', () => {
  it('exists', () => {
    expect(existsSync(brand('logo-mono.svg'))).toBe(true);
  });

  it('has the lockup viewBox 0 0 800 256', () => {
    const svg = readFileSync(brand('logo-mono.svg'), 'utf8');
    expect(svg).toMatch(/viewBox\s*=\s*"0 0 800 256"/);
  });

  it('contains no gradient fills or strokes', () => {
    const svg = readFileSync(brand('logo-mono.svg'), 'utf8');
    expect(svg).not.toMatch(/url\(#/);
    expect(svg).not.toMatch(/<linearGradient/);
    expect(svg).not.toMatch(/<radialGradient/);
  });

  it('uses only white as a visible color', () => {
    const svg = readFileSync(brand('logo-mono.svg'), 'utf8');
    // No cyan tokens
    expect(svg.toLowerCase()).not.toContain('#5ec8ff');
    expect(svg.toLowerCase()).not.toContain('#2860e0');
    // White appears
    expect(svg.toLowerCase()).toContain('#ffffff');
  });
});

describe('layout metadata', () => {
  const layoutPath = resolve(root, 'app', 'layout.tsx');
  const layout = () => readFileSync(layoutPath, 'utf8');

  it('declares all four favicon PNG paths', () => {
    const src = layout();
    expect(src).toContain("/brand/favicon-32.png");
    expect(src).toContain("/brand/favicon-64.png");
    expect(src).toContain("/brand/favicon-192.png");
    expect(src).toContain("/brand/favicon-512.png");
  });

  it('declares the OG image with 1200x630', () => {
    const src = layout();
    expect(src).toContain("/brand/og.png");
    expect(src).toMatch(/width:\s*1200/);
    expect(src).toMatch(/height:\s*630/);
  });

  it('declares apple-touch icon pointing at the 192px favicon', () => {
    const src = layout();
    // The 192px file should appear both under `icon:` and under `apple:`.
    // A simple proxy: it appears at least twice in the file.
    const matches = src.match(/\/brand\/favicon-192\.png/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('sets metadataBase with the rhymefor.fun fallback', () => {
    const src = layout();
    expect(src).toMatch(/metadataBase:\s*new URL\(/);
    expect(src).toContain('rhymefor.fun');
  });
});

// PNG IHDR chunk starts at byte offset 16. Width is bytes 16-19, height is 20-23.
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`not a PNG: ${path}`);
  }
  const chunkType = buf.toString('ascii', 12, 16);
  if (chunkType !== 'IHDR') {
    throw new Error(`expected IHDR chunk, got ${chunkType}: ${path}`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe('PNG exports', () => {
  it.each([
    ['favicon-32.png', 32, 32],
    ['favicon-64.png', 64, 64],
    ['favicon-192.png', 192, 192],
    ['favicon-512.png', 512, 512],
    ['og.png', 1200, 630],
  ])('%s is %d×%d', (name, w, h) => {
    const path = brand(name);
    expect(existsSync(path)).toBe(true);
    const size = pngSize(path);
    expect(size.width).toBe(w);
    expect(size.height).toBe(h);
  });
});
