// scripts/export-brand.mjs
// Rasterizes public/brand/{mark,logo}.svg to PNGs via @resvg/resvg-js.
//
// @resvg/resvg-js does NOT support WOFF/WOFF2 directly, but @fontsource/manrope
// ships only WOFF/WOFF2. So we decompress the WOFF2 to TTF in-memory using
// wawoff2, write it to a temp file, and hand resvg that TTF path.
import { Resvg } from '@resvg/resvg-js';
import wawoff from 'wawoff2';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const brandDir = resolve(repoRoot, 'public', 'brand');
const woff2Path = resolve(
  repoRoot,
  'node_modules',
  '@fontsource',
  'manrope',
  'files',
  'manrope-latin-600-normal.woff2',
);

async function prepareFont() {
  const woff2 = readFileSync(woff2Path);
  const ttf = await wawoff.decompress(woff2);
  const tmpDir = mkdtempSync(join(tmpdir(), 'rhymefor-brand-'));
  try {
    const ttfPath = join(tmpDir, 'manrope-600.ttf');
    writeFileSync(ttfPath, Buffer.from(ttf));
    return { ttfPath, tmpDir };
  } catch (e) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw e;
  }
}

function rasterize(svgPath, width, fontFile) {
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
  // Strip outer <svg ...></svg> and re-embed children inside a transformed
  // group on a 1200x630 canvas. Keeps the renderer's job simple — no nested
  // <svg> elements.
  // NOTE: This regex-strip approach assumes logo.svg has exactly one outer
  // <svg> element with no nested <svg> children. The trailing `</svg>\s*$`
  // match would strip the wrong tag if a nested SVG were ever added. If
  // logo.svg gains nested SVG content in the future, replace this with a
  // real XML parser (e.g. @xmldom/xmldom) and walk the tree.
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

const { ttfPath, tmpDir } = await prepareFont();
console.log(`Manrope TTF (from WOFF2 decompress): ${ttfPath}`);

try {
  const markPath = resolve(brandDir, 'mark.svg');
  const logoPath = resolve(brandDir, 'logo.svg');

  for (const size of [32, 64, 192, 512]) {
    const out = resolve(brandDir, `favicon-${size}.png`);
    writeFileSync(out, rasterize(markPath, size, ttfPath));
    console.log(`wrote ${out}`);
  }

  const ogOut = resolve(brandDir, 'og.png');
  writeFileSync(ogOut, rasterizeWithBackground(logoPath, 1200, 630, '#080808', ttfPath));
  console.log(`wrote ${ogOut}`);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
