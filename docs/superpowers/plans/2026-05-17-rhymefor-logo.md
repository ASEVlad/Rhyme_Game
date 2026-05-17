# rhymefor.fun Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the rhymefor.fun logo per [the design spec](../specs/2026-05-17-logo-design.md): three SVGs (mark, primary lockup, mono fallback), four PNG favicon sizes, one OG image, and Next.js metadata wiring.

**Architecture:** SVG-first. Hand-author the three SVGs as the source of truth. Generate PNGs deterministically from those SVGs via a Node script using `@resvg/resvg-js` (Rust-backed SVG renderer) with the Manrope TTF from `@fontsource/manrope` loaded explicitly — that way text rendering doesn't depend on system fonts. Wire favicon + Open Graph into Next.js via `metadata` in `app/layout.tsx`.

**Tech Stack:** Hand-authored SVG, `@resvg/resvg-js` (dev dep), `@fontsource/manrope` (dev dep), Next.js 14 `metadata`, vitest.

---

## File Structure

| File | Purpose | Created/Modified |
|------|---------|------------------|
| `public/brand/mark.svg` | Icon-only mark (256×256 viewBox). No text. | Create |
| `public/brand/logo.svg` | Primary lockup: mark + wordmark on dark. Wordmark uses `<text>` with Manrope — browsers resolve from the existing `--font-manrope` load. | Create |
| `public/brand/logo-mono.svg` | Mono-white variant of the lockup. Same structure as `logo.svg` but no gradients, no specular — flat `#ffffff` everywhere. | Create |
| `public/brand/favicon-32.png` `-64.png` `-192.png` `-512.png` | Favicon PNG exports rasterized from `mark.svg`. | Create (via script) |
| `public/brand/og.png` | 1200×630 Open Graph image. Logo lockup centered on `#080808`. | Create (via script) |
| `scripts/export-brand.mjs` | Node ESM script that reads the SVGs, loads Manrope TTF from `@fontsource/manrope`, and writes the five PNGs to `public/brand/`. | Create |
| `app/layout.tsx` | Add `icons` and `openGraph` fields to the exported `metadata`. | Modify |
| `package.json` | Add `@resvg/resvg-js` and `@fontsource/manrope` as devDependencies; add `brand:export` script. | Modify |
| `tests/brand.test.ts` | Vitest checks: SVG files exist and parse, PNGs exist at the right dimensions, `app/layout.tsx` metadata exposes the expected icons + OG paths. | Create |

Each task below produces a self-contained commit.

---

## Task 1: Add dev dependencies and brand directory

**Files:**
- Modify: `package.json`
- Create: `public/brand/.gitkeep`

- [ ] **Step 1: Install dev dependencies**

Run from repo root:

```bash
npm install --save-dev @resvg/resvg-js @fontsource/manrope
```

Expected: both packages added to `devDependencies` in `package.json`. `node_modules/@fontsource/manrope/files/manrope-latin-600-normal.woff2` (and `.ttf` neighbors) exists after install.

- [ ] **Step 2: Verify Manrope SemiBold TTF is available**

Run:

```bash
ls node_modules/@fontsource/manrope/files/ | grep -E '600.*\.(ttf|woff)$'
```

Expected: at least one match including a `.ttf` for weight 600. If only `.woff2` is present, the export script (Task 5) will use the WOFF variant — `@resvg/resvg-js` accepts both. Note the exact file path; you'll reference it in the export script.

- [ ] **Step 3: Create the brand directory**

```bash
mkdir -p public/brand
touch public/brand/.gitkeep
```

- [ ] **Step 4: Add `brand:export` npm script**

Edit `package.json` `scripts` to add one entry. The existing scripts block looks like:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Change it to:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "test:watch": "vitest",
  "brand:export": "node scripts/export-brand.mjs"
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json public/brand/.gitkeep
git commit -m "chore(brand): add resvg + fontsource manrope deps, scaffold public/brand"
```

---

## Task 2: Author `mark.svg` (icon-only)

**Files:**
- Create: `public/brand/mark.svg`
- Create: `tests/brand.test.ts`

**Geometry reference** (used throughout this task):

- ViewBox: `0 0 256 256` (square — favicon-friendly).
- Ring radius `r = 56`.
- Center-to-center distance `d = 78` → 30% diameter overlap (overlap = 2r − d = 34, which is 30% of diameter 112; the spec calls for ~30%, this matches).
- Ring A (left) center: `(89, 128)`. Ring B (right) center: `(167, 128)`.
- Stroke width: `14` (≈12.5% of diameter — matches the spec's "~12% of ring diameter, readable at 32×32").
- Crossing points: `y = 128 ± √(r² − (d/2)²) = 128 ± √(3136 − 1521) = 128 ± √1615 ≈ 128 ± 40.19`. Top crossing `(128, 87.81)`, bottom crossing `(128, 168.19)`.
- Interlock arc (B passes over A at the bottom crossing): an arc on Ring B spanning roughly ±18° around the bottom crossing. Endpoints (computed from B's center at angles ≈116° and ≈152° CCW from +x):
  - Start: `(142.46, 178.31)`
  - End:   `(117.55, 154.30)`

- [ ] **Step 1: Write failing tests for the mark**

Create `tests/brand.test.ts`:

```ts
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
    expect(svg.match(/cy\s*=\s*"128"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('uses the chrome gradient with the Tailwind cyan tokens', () => {
    const svg = readFileSync(brand('mark.svg'), 'utf8');
    expect(svg.toLowerCase()).toContain('#5ec8ff');
    expect(svg.toLowerCase()).toContain('#2860e0');
  });
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

```bash
npx vitest run tests/brand.test.ts
```

Expected: all four tests fail because `public/brand/mark.svg` does not exist.

- [ ] **Step 3: Author `mark.svg`**

Create `public/brand/mark.svg` with this exact content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="rhymefor.fun mark">
  <defs>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5ec8ff"/>
      <stop offset="1" stop-color="#2860e0"/>
    </linearGradient>
    <radialGradient id="spec-a" cx="0.3" cy="0.25" r="0.45">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="spec-b" cx="0.3" cy="0.25" r="0.45">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Ring B (right), back -->
  <circle cx="167" cy="128" r="56" fill="none" stroke="url(#chrome)" stroke-width="14"/>
  <circle cx="167" cy="128" r="56" fill="none" stroke="url(#spec-b)" stroke-width="14"/>

  <!-- Ring A (left), front at both crossings -->
  <circle cx="89" cy="128" r="56" fill="none" stroke="url(#chrome)" stroke-width="14"/>
  <circle cx="89" cy="128" r="56" fill="none" stroke="url(#spec-a)" stroke-width="14"/>

  <!-- Interlock: arc of Ring B drawn on top of A at the bottom crossing
       so B passes over A there, completing the chain-link effect. -->
  <path d="M 142.46 178.31 A 56 56 0 0 0 117.55 154.30"
        fill="none" stroke="url(#chrome)" stroke-width="14" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 4: Run the tests, confirm they pass**

```bash
npx vitest run tests/brand.test.ts
```

Expected: all four tests pass.

- [ ] **Step 5: Visual sanity check**

Open `public/brand/mark.svg` in a browser (or VS Code SVG preview). Expected:

- Two interlocking rings, cyan-to-blue gradient top-to-bottom on the strokes.
- The right ring visibly passes *over* the left ring at the bottom crossing.
- The left ring visibly passes *over* the right ring at the top crossing.

If the interlock direction is reversed (left ring goes over at bottom instead of top), flip the **sweep flag** in the path `d` attribute from `0` to `1`: change `A 56 56 0 0 0` to `A 56 56 0 0 1`. Re-check the browser.

If the arc endpoints visually don't sit on Ring B's circumference cleanly, the coordinates may need a half-pixel tweak — recompute against the geometry reference at the top of this task and adjust.

- [ ] **Step 6: Commit**

```bash
git add public/brand/mark.svg tests/brand.test.ts
git commit -m "feat(brand): add rhymefor.fun icon mark (interlocked chrome rings)"
```

---

## Task 3: Author `logo.svg` (primary lockup)

**Files:**
- Create: `public/brand/logo.svg`
- Modify: `tests/brand.test.ts`

**Lockup geometry:**

- ViewBox: `0 0 800 256`. Tall enough to hold the 256-unit-tall mark with comfortable vertical padding for the wordmark.
- Icon: scaled instance of `mark.svg` content, fit inside a 192×192 box positioned with top-left at `(24, 32)` — i.e. centered vertically within the 256-tall viewBox with 32 units of padding top/bottom.
- Gap between icon's right edge (`x=216`) and wordmark's left edge: 28 units. Wordmark starts at `x=244`.
- Wordmark: `<text>` element using `font-family="Manrope, system-ui, sans-serif"`, `font-weight="600"`, `font-size="92"`, `fill="#ffffff"`, baseline-positioned via `y` and `dominant-baseline`.
- Wordmark vertical position: align the text's x-height midline with the icon's vertical center (`y=128` in the viewBox). For Manrope at 92px font-size with `dominant-baseline="alphabetic"`, that means the baseline `y` sits at approximately `128 + (xHeight / 2) ≈ 128 + 24 ≈ 152`. We'll set `y="152"` and visually adjust by ±4 if needed.
- Letter-spacing: `-2` (slightly tight, per spec).

- [ ] **Step 1: Extend `tests/brand.test.ts` with failing tests for the lockup**

Append to `tests/brand.test.ts`:

```ts
describe('logo.svg', () => {
  it('exists', () => {
    expect(existsSync(brand('logo.svg'))).toBe(true);
  });

  it('has the lockup viewBox 0 0 800 256', () => {
    const svg = readFileSync(brand('logo.svg'), 'utf8');
    expect(svg).toMatch(/viewBox\s*=\s*"0 0 800 256"/);
  });

  it('contains the wordmark text', () => {
    const svg = readFileSync(brand('logo.svg'), 'utf8');
    expect(svg).toContain('rhymefor.fun');
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
```

- [ ] **Step 2: Run the tests, confirm the new ones fail**

```bash
npx vitest run tests/brand.test.ts
```

Expected: the five `logo.svg` tests fail; the four `mark.svg` tests still pass.

- [ ] **Step 3: Author `logo.svg`**

Create `public/brand/logo.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 256" width="800" height="256" role="img" aria-label="rhymefor.fun">
  <defs>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5ec8ff"/>
      <stop offset="1" stop-color="#2860e0"/>
    </linearGradient>
    <radialGradient id="spec-a" cx="0.3" cy="0.25" r="0.45">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="spec-b" cx="0.3" cy="0.25" r="0.45">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Icon mark: scaled to 192×192, top-left at (24, 32) -->
  <g transform="translate(24 32) scale(0.75)">
    <circle cx="167" cy="128" r="56" fill="none" stroke="url(#chrome)" stroke-width="14"/>
    <circle cx="167" cy="128" r="56" fill="none" stroke="url(#spec-b)" stroke-width="14"/>
    <circle cx="89" cy="128" r="56" fill="none" stroke="url(#chrome)" stroke-width="14"/>
    <circle cx="89" cy="128" r="56" fill="none" stroke="url(#spec-a)" stroke-width="14"/>
    <path d="M 142.46 178.31 A 56 56 0 0 0 117.55 154.30"
          fill="none" stroke="url(#chrome)" stroke-width="14" stroke-linecap="round"/>
  </g>

  <!-- Wordmark -->
  <text x="244" y="152"
        font-family="Manrope, system-ui, sans-serif"
        font-weight="600"
        font-size="92"
        letter-spacing="-2"
        fill="#ffffff"
        dominant-baseline="alphabetic">rhymefor.fun</text>
</svg>
```

- [ ] **Step 4: Run the tests, confirm they pass**

```bash
npx vitest run tests/brand.test.ts
```

Expected: all nine tests pass.

- [ ] **Step 5: Visual sanity check**

Open `public/brand/logo.svg` in a browser. Expected:

- The mark sits left, wordmark "rhymefor.fun" sits right at roughly equal visual weight.
- Wordmark x-height midline aligns with the icon's vertical center.
- Wordmark reads as one continuous word, no awkward gap before `.fun`.

If the wordmark sits too high or low relative to the icon, adjust the `y` attribute of the `<text>` element by ±2-6. If the gap between icon and wordmark looks wrong, adjust the `x` attribute of the `<text>` element.

If you see a fallback sans (not Manrope) — that's fine in some browsers if Manrope isn't loaded on the standalone page. The in-app rendering will pick up Manrope from `app/layout.tsx`. PNG export (Task 5) will use the loaded TTF explicitly.

- [ ] **Step 6: Commit**

```bash
git add public/brand/logo.svg tests/brand.test.ts
git commit -m "feat(brand): add rhymefor.fun primary lockup logo"
```

---

## Task 4: Author `logo-mono.svg` (monochrome variant)

**Files:**
- Create: `public/brand/logo-mono.svg`
- Modify: `tests/brand.test.ts`

The mono variant is structurally identical to `logo.svg` but:
- No gradient (`url(#chrome)` becomes `#ffffff`).
- No specular highlight layers — drop both spec radial gradients and the duplicate spec strokes.
- Wordmark stays `#ffffff`.

Result: a flat white logo usable on any darker background, or — when consumers invert it via CSS `filter: invert(1)` — on a light background.

- [ ] **Step 1: Extend the tests**

Append to `tests/brand.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests, confirm the new ones fail**

```bash
npx vitest run tests/brand.test.ts
```

Expected: the four `logo-mono.svg` tests fail; everything else still passes.

- [ ] **Step 3: Author `logo-mono.svg`**

Create `public/brand/logo-mono.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 256" width="800" height="256" role="img" aria-label="rhymefor.fun">
  <g transform="translate(24 32) scale(0.75)">
    <circle cx="167" cy="128" r="56" fill="none" stroke="#ffffff" stroke-width="14"/>
    <circle cx="89" cy="128" r="56" fill="none" stroke="#ffffff" stroke-width="14"/>
    <path d="M 142.46 178.31 A 56 56 0 0 0 117.55 154.30"
          fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
  </g>

  <text x="244" y="152"
        font-family="Manrope, system-ui, sans-serif"
        font-weight="600"
        font-size="92"
        letter-spacing="-2"
        fill="#ffffff"
        dominant-baseline="alphabetic">rhymefor.fun</text>
</svg>
```

- [ ] **Step 4: Run the tests, confirm they pass**

```bash
npx vitest run tests/brand.test.ts
```

Expected: all 13 tests pass.

- [ ] **Step 5: Visual sanity check**

Open `public/brand/logo-mono.svg` in a browser. Expected:

- Flat white mark + flat white wordmark on whatever background the viewer shows (often white in browsers).
- If your browser previews on a white background, the logo will look invisible — that's correct. Open it inside an HTML page with `style="background:#080808"` if you want to see it.

Quick verification page (don't commit this, just a temp file):

```bash
cat > /tmp/mono-preview.html <<'EOF'
<html><body style="margin:0;background:#080808;display:grid;place-items:center;min-height:100vh">
<img src="file:///$(pwd)/public/brand/logo-mono.svg" width="800"/>
</body></html>
EOF
```

Then open `/tmp/mono-preview.html` in a browser. (Adjust the `file://` path or use a local web server if `file://` doesn't permit SVG loads.)

- [ ] **Step 6: Commit**

```bash
git add public/brand/logo-mono.svg tests/brand.test.ts
git commit -m "feat(brand): add monochrome white logo variant"
```

---

## Task 5: Generate PNG exports

**Files:**
- Create: `scripts/export-brand.mjs`
- Modify: `tests/brand.test.ts`
- Generated (not hand-edited): `public/brand/favicon-{32,64,192,512}.png`, `public/brand/og.png`

- [ ] **Step 1: Extend the tests with PNG dimension checks**

Append to `tests/brand.test.ts`:

```ts
import { Buffer } from 'node:buffer';

// PNG IHDR chunk starts at byte offset 16. Width is bytes 16-19, height is 20-23.
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`not a PNG: ${path}`);
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
```

- [ ] **Step 2: Run tests, confirm the new ones fail**

```bash
npx vitest run tests/brand.test.ts
```

Expected: five PNG-dimension tests fail (files don't exist yet); everything else passes.

- [ ] **Step 3: Write the export script**

Create `scripts/export-brand.mjs`:

```js
// scripts/export-brand.mjs
// Rasterizes public/brand/{mark,logo}.svg to PNGs via @resvg/resvg-js,
// loading Manrope SemiBold from @fontsource/manrope so text renders
// without any system-font dependency.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const brandDir = resolve(repoRoot, 'public', 'brand');
const fontDir = resolve(repoRoot, 'node_modules', '@fontsource', 'manrope', 'files');

function findManropeSemibold() {
  if (!existsSync(fontDir)) {
    throw new Error(`Manrope font dir not found at ${fontDir}. Did you run 'npm install'?`);
  }
  // Prefer TTF, fall back to WOFF/WOFF2.
  const files = readdirSync(fontDir);
  const candidates = [
    files.find((f) => /latin-600-normal\.ttf$/.test(f)),
    files.find((f) => /latin-600-normal\.woff$/.test(f)),
    files.find((f) => /latin-600-normal\.woff2$/.test(f)),
    files.find((f) => /600.*\.ttf$/.test(f)),
    files.find((f) => /600.*\.woff$/.test(f)),
    files.find((f) => /600.*\.woff2$/.test(f)),
  ].filter(Boolean);
  if (candidates.length === 0) {
    throw new Error(`No Manrope 600 font file found in ${fontDir}`);
  }
  return resolve(fontDir, candidates[0]);
}

function rasterize(svgPath, { width }, fontFile) {
  const svg = readFileSync(svgPath, 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      fontFiles: [fontFile],
      loadSystemFonts: false,
      defaultFontFamily: 'Manrope',
    },
    background: 'rgba(0,0,0,0)',
  });
  return resvg.render().asPng();
}

function rasterizeWithBackground(svgPath, width, height, bg, fontFile) {
  // Strip the outer <svg ...></svg> wrapper from logo.svg and re-embed its
  // children directly inside a transformed group on a new 1200x630 canvas.
  // No nested <svg> — keeps the renderer's job simple.
  const inner = readFileSync(svgPath, 'utf8')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');

  // Logo lockup is 800x256 in its native viewBox. Scale to ~70% of OG width.
  const targetW = Math.round(width * 0.7);
  const targetH = Math.round(targetW * (256 / 800));
  const x = Math.round((width - targetW) / 2);
  const y = Math.round((height - targetH) / 2);
  const scale = targetW / 800;

  const composed = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${bg}"/>
    <g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>
  </svg>`;

  const resvg = new Resvg(composed, {
    fitTo: { mode: 'width', value: width },
    font: {
      fontFiles: [fontFile],
      loadSystemFonts: false,
      defaultFontFamily: 'Manrope',
    },
  });
  return resvg.render().asPng();
}

const fontFile = findManropeSemibold();
console.log(`Using font: ${fontFile}`);

const markPath = resolve(brandDir, 'mark.svg');
const logoPath = resolve(brandDir, 'logo.svg');

for (const size of [32, 64, 192, 512]) {
  const out = resolve(brandDir, `favicon-${size}.png`);
  writeFileSync(out, rasterize(markPath, { width: size }, fontFile));
  console.log(`wrote ${out}`);
}

const ogOut = resolve(brandDir, 'og.png');
writeFileSync(ogOut, rasterizeWithBackground(logoPath, 1200, 630, '#080808', fontFile));
console.log(`wrote ${ogOut}`);
```

- [ ] **Step 4: Run the export script**

```bash
npm run brand:export
```

Expected output (file paths will vary based on resolved font file):

```
Using font: /…/node_modules/@fontsource/manrope/files/manrope-latin-600-normal.ttf
wrote …/public/brand/favicon-32.png
wrote …/public/brand/favicon-64.png
wrote …/public/brand/favicon-192.png
wrote …/public/brand/favicon-512.png
wrote …/public/brand/og.png
```

- [ ] **Step 5: Run the tests, confirm they pass**

```bash
npx vitest run tests/brand.test.ts
```

Expected: all 18 tests pass.

- [ ] **Step 6: Visual sanity check**

Open each generated PNG:

- `favicon-32.png` — at native size in an image viewer or by visiting `file://…/public/brand/favicon-32.png`. The interlock should still be visible (not just two blurry blobs).
- `favicon-512.png` — sharp, clear gradient.
- `og.png` — lockup centered on `#080808`, generous margin, Manrope wordmark rendered crisply.

If `og.png` renders the wordmark in a fallback sans (visibly different from Manrope), the font wasn't found. Re-read the script output to confirm `Using font:` points to a real `.ttf`/`.woff`/`.woff2`. If the resolved file is `.woff2`, try installing `npm install --save-dev @fontsource/manrope` again to ensure `.ttf` is present, or update the `candidates` array order in the script.

- [ ] **Step 7: Commit**

```bash
git add scripts/export-brand.mjs tests/brand.test.ts public/brand/favicon-*.png public/brand/og.png
git commit -m "feat(brand): export favicon and OG PNGs from SVG sources"
```

---

## Task 6: Wire favicon + OG into Next.js metadata

**Files:**
- Modify: `app/layout.tsx`
- Modify: `tests/brand.test.ts`

- [ ] **Step 1: Add a failing test for the metadata wiring**

We can't `await import('../app/layout')` here because `app/layout.tsx` imports `next/font/google`, which runs only inside the Next.js build pipeline. Use a file-content assertion instead — brittle to whitespace but robust to module loading.

Append to `tests/brand.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run, confirm it fails**

```bash
npx vitest run tests/brand.test.ts
```

Expected: the new test fails (metadata has no `icons` or `openGraph` field yet).

- [ ] **Step 3: Update `app/layout.tsx`**

Current `metadata` export looks like:

```ts
export const metadata: Metadata = {
  title: 'The Rhyme Game',
  description: 'A web game for freestyle rap practice',
};
```

Replace with:

```ts
export const metadata: Metadata = {
  title: 'The Rhyme Game',
  description: 'A web game for freestyle rap practice',
  icons: {
    icon: [
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/brand/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/brand/favicon-192.png' },
    ],
  },
  openGraph: {
    title: 'The Rhyme Game',
    description: 'A web game for freestyle rap practice',
    images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'rhymefor.fun' }],
  },
};
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npx vitest run tests/brand.test.ts
```

Expected: all 21 tests pass (4 mark + 5 logo + 4 mono + 5 PNG + 3 layout).

- [ ] **Step 5: Boot the dev server and verify favicon delivery in a browser**

```bash
npm run dev
```

Open the app in a browser (default `http://localhost:3000`). Check:

- Browser tab shows the icon mark, not a default globe icon. (You may need to hard-refresh to bypass favicon cache.)
- Inspect element → `<head>` should contain `<link rel="icon" href="/brand/favicon-32.png" sizes="32x32">` and the other size variants.
- Visit `/brand/og.png` directly — the OG image renders at 1200×630.

Stop the dev server (`Ctrl+C`) when satisfied.

- [ ] **Step 6: Verify the existing pages still render**

With the dev server running, visit the login, setup (`/`), and play screens. Confirm none of them render broken — the metadata change should be invisible at the page level.

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx tests/brand.test.ts
git commit -m "feat(brand): wire favicon and Open Graph into layout metadata"
```

---

## Task 7: Final acceptance pass against the spec

**Files:** none modified — this is a verification task.

Walk through each of the [spec's acceptance checks](../specs/2026-05-17-logo-design.md#acceptance-checks) and confirm:

- [ ] **Check 1: Favicon legibility at 32×32.** Open `public/brand/favicon-32.png` at native size in an image viewer. The interlock between the two rings is visible — not just two blurry overlapping circles. If not, increase the stroke width in `mark.svg` from `14` to `16` and re-run `npm run brand:export`.

- [ ] **Check 2: Primary lockup at OG size.** Open `public/brand/og.png` at full 1200×630 resolution. The cyan-to-blue gradient on the icon is smooth (no banding). Stroke edges are clean (no aliasing artifacts). The wordmark "rhymefor.fun" is rendered in Manrope, not a fallback sans.

- [ ] **Check 3: OG image survives downscale.** Open `og.png` and view it at ~600px wide (browser zoom to 50%, or open in an image editor and resize). The wordmark is still legible at that size.

- [ ] **Check 4: Mono variant covers its use cases.**
  - (a) Open `logo-mono.svg` in a browser with the page background set to white (e.g. wrap the svg in an HTML page with `<body style="background:#fff">` and apply `filter: invert(1)` to the img element to flip it to black). Black-on-white should be legible.
  - (b) Composite `logo-mono.svg` over a busy background (e.g. one of the setup-screen background images) at typical display size. Interlock detail survives — the mono variant doesn't disappear into the imagery.

- [ ] **Check 5: No layout regressions.**
  - Run `npm run test` — all tests pass, including pre-existing ones.
  - `npm run dev`, then walk through login → setup → play (Classic mode) → calibrate. No visible regressions vs. before this work.

- [ ] **If any check fails:** iterate on the relevant SVG, re-run `npm run brand:export`, re-run tests, repeat the check. Don't proceed to wrap-up until all five checks pass.

- [ ] **Final commit (only if any fixes were needed in this task):**

```bash
git add -p
git commit -m "fix(brand): adjustments from final acceptance pass"
```

If no fixes were needed, this task produces no commit — that's expected.

---

## What's left out (matches the spec's Out of Scope)

- Motion treatment / animated boot logo
- Light-background full-color variant (mono variant covers light-bg use)
- Merchandise / print lockups
- Localized wordmark (Римова Гра Cyrillic version)

Each can be a follow-up spec + plan if/when needed.
