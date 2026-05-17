# Logo — rhymefor.fun

**Status:** Drafted 2026-05-17 (concept approved; written spec pending user review)
**Project:** Римова Гра (rhymefor.fun)

## Goal

Give the project a primary logo that feels native to the existing app — the same Ice & Chrome aesthetic used on the setup screen — and that works in the contexts the app actually has today: the browser favicon, social/OG previews, and any future on-screen surface that needs a brand mark (e.g. the setup screen, a marketing site). One mark, multiple uses, no redraws.

## Concept

Two interlocking chrome rings, side by side, beside the lowercase wordmark `rhymefor.fun`.

The rings read as a *rhyme pair*: two sounds linked. The chrome treatment continues the app's Ice & Chrome direction (cyan-to-blue gradient on near-black) so the logo feels like part of the product rather than an external badge.

## Icon mark

- **Geometry.** Two equal circles, stroke only, overlapping by ~30% of their diameter, side by side on a horizontal axis. The bounding box of the mark is square, with the rings centered and given comfortable padding so the favicon doesn't crowd the edges.
- **Interlock.** True chain-link interlock at the crossings — one ring passes in front, the other passes behind. Not a flat overlap. This is the detail that sells "linked," not just "two circles."
- **Stroke.** Medium-thick stroke (target ~12% of ring diameter — readable at 32×32 favicon). Stroke uses a vertical chrome gradient: `#5ec8ff` at the top transitioning to `#2860e0` at the bottom (the existing `rhyme-cyan-from` → `rhyme-cyan-to` tokens in [tailwind.config.ts](tailwind.config.ts)).
- **Specular highlight.** A small white-to-transparent hotspot on the upper-left arc of each ring (~10–15% opacity peak) to suggest a curved metal surface under a light source. Subtle — must not dominate the gradient.
- **Background.** Transparent SVG. Designed for the app's `#080808` background. A light-background variant is explicitly out of scope (see below) — if the mark ends up on a light surface, use the monochrome variant instead.

## Wordmark

- **Text.** `rhymefor.fun`, all lowercase, exactly as the domain. No additional tagline.
- **Type.** Manrope — the project's existing sans (loaded as `--font-manrope` in [app/layout.tsx](app/layout.tsx) and aliased to `font-sans` in [tailwind.config.ts](tailwind.config.ts)).
- **Weight.** 500–600 (medium / semibold). Pick the heaviest weight that still keeps the wordmark visually quieter than the icon. Final weight chosen during execution.
- **Color.** Primary: white `#ffffff` on the dark background. The icon carries the brand color; the wordmark stays neutral so it doesn't compete with the chrome.
- **Tracking.** Slightly tight (around -10 to -20 units, tuned by eye) so `rhymefor.fun` reads as one continuous word and the `.fun` doesn't feel like a TLD label.

## Lockup

- **Primary (horizontal).** Icon on the left, wordmark on the right. Vertical alignment: the icon's vertical center aligns with the wordmark's x-height midline (not its bounding-box center — this is the visually balanced choice for short lowercase wordmarks).
- **Gap.** Distance between the right edge of the icon and the left edge of the `r` ≈ the cap height of the wordmark. Tune by eye.
- **Icon size relative to wordmark.** Icon bounding box ≈ 1.6–1.8× the wordmark's x-height. Adjust so the mark feels equal in weight to the wordmark, not larger or smaller.

## Variants

| # | Variant | Purpose | Format |
|---|---------|---------|--------|
| 1 | Primary lockup, dark-bg | App header, marketing site header, hero | SVG |
| 2 | Icon-only mark | Favicon, collapsed-nav badge, social avatar | SVG (square) |
| 3 | Monochrome white | Places the chrome gradient can't render (single-color print, OG image text overlays, dark monochrome UIs) | SVG |
| 4 | Favicon raster exports | Browser tabs, PWA manifest, mobile home screen | PNG @ 32, 64, 192, 512 |
| 5 | OG / social image | Open Graph + Twitter card | PNG 1200×630, lockup centered on `#080808` |

The light-background variant is intentionally out of scope; current product surfaces are all dark. Revisit if/when a light surface appears.

## Color tokens

All values come from the existing palette in [tailwind.config.ts](tailwind.config.ts) so the logo can't drift from the rest of the UI:

| Token | Hex | Used for |
|-------|-----|----------|
| `bg` | `#080808` | Background |
| `rhyme.cyan-from` | `#5ec8ff` | Top of icon gradient |
| `rhyme.cyan-to` | `#2860e0` | Bottom of icon gradient |
| (white) | `#ffffff` | Wordmark, specular highlight |

## File layout

Logo files live under `public/brand/`:

```
public/brand/
  logo.svg              # primary lockup, dark-bg
  logo-mono.svg         # monochrome white fallback
  mark.svg              # icon-only, square
  favicon-32.png
  favicon-64.png
  favicon-192.png
  favicon-512.png
  og.png                # 1200×630 social card
```

Favicon wiring is updated in [app/layout.tsx](app/layout.tsx) via Next.js `metadata.icons` so the right size is served per context.

## Acceptance checks

Before declaring the logo done, the following must all be true:

1. **Favicon legibility.** The icon-only mark is recognizable at 32×32 in a real browser tab — interlock is visible, not just two blurry circles.
2. **Primary lockup renders crisply.** The full lockup, rendered at the size it appears on the largest current surface (1200×630 OG image), shows clean stroke edges and a visible gradient on the icon — no aliasing, no banding.
3. **OG image validates locally.** The 1200×630 PNG opens cleanly at full resolution, the lockup is centered with adequate margin, and a manual preview at typical social-card display size (~600px wide) is still legible. Live unfurler testing is nice-to-have but not required for sign-off.
4. **Mono variant covers its use cases.** `logo-mono.svg` is legible (a) inverted to black on a light background, and (b) overlaid on the existing setup-screen background imagery without losing the interlock detail.
5. **No layout regressions.** Adding favicon and OG metadata to `app/layout.tsx` doesn't break the setup, play, or login screens — they still render unchanged.

## Out of scope

- Motion treatment (e.g. animated boot logo)
- Light-background variant
- Merchandise or print lockups
- Localized wordmark (Cyrillic `Римова Гра`) — current decision is English domain only

These can be added later as separate specs if the product needs them.
