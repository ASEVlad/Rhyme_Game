# Landing & Login Layout Redesign

Pre-auth funnel (landing page + login page) on the current `master` branch reads
as floating, low-hierarchy, and partially broken in the decorative regions. The
Ice & Chrome visual style is preserved — colors, gradient, type, glow, radii
all stay. This redesign is structural: composition, spacing, sizing, and
information architecture only.

## Problem

Captured from `npm run dev` at `1280×800` (desktop) and `390×844` (mobile):

**Landing — desktop**
- Decorative right-column "grid" is an abstract block of colored capsules; the
  ball is a dot you barely notice; no rhythm, no story.
- Left column has ~250 px of dead air above the eyebrow text.
- `GET STARTED` CTA is undersized relative to the title — reads as an
  afterthought beneath the body copy.
- Three bottom feature pills (Beat / Rhyme / Flow) are one-word labels in
  equal-width tiles — filler, not information.

**Landing — mobile**
- Decorative grid disappears entirely under `hidden md:flex`. The product's
  signature visual is missing from the primary form factor.
- ~30% of the viewport above the eyebrow is empty.
- Feature pills wrap awkwardly ("Lock to the / bar") in three cells.

**Login — desktop**
- ~500 px of black corridor between the title block (left edge) and the auth
  card (right edge). Both halves cling to opposite edges.
- The decorative grid duplicates landing and contains a "focus row" with
  `ring-2 ring-white/80` outlines that reads as broken/loading state.
- The auth card stacks 7 elements (title, subtitle, Google, "or" divider,
  waitlist label, email input, waitlist button, back link) — kitchen sink.

**Login — mobile**
- 60% of the viewport below the card is empty.
- No visual reference to the game anywhere.

**Cross-cutting**
- Both pages center content vertically — content clumps in a 40% band,
  dead air above and below.
- Spacing scale is inconsistent: `space-y-5`, `gap-3`, `py-2.5`, `p-8`,
  `gap-5`, `tracking-[0.15em]`, all arbitrary.
- Three type tiers (display / eyebrow / body) but the eyebrow is too weak
  to function as a real tier — weakens hierarchy instead of strengthening it.

## Goals

1. Anchor content to the viewport — no more "floating mid-page" composition.
2. Establish one consistent spacing scale (base-8) and two type tiers.
3. Give mobile and desktop the same compositional structure.
4. Reduce the auth card to one primary action plus minimal secondary affordances.
5. Stop duplicating the decorative grid between landing and login; give each
   page its own visual moment.
6. Keep all existing visual tokens (colors, gradient, font, glow, radii).
7. Don't touch the in-game screens (Setup, Play, End). Pre-auth funnel only.

## Approach

Chosen direction: **Anchored stack** (refinement, not reinvention).

Two alternatives were considered and rejected for this iteration:
- **Live stage** — replace the decorative grid with the real `WordGrid` +
  `BouncingBall` running in a looping preview mode. Most communicative but
  requires extracting a non-interactive mode for those components and making
  an audio decision. Deferred — can layer onto the new B structure later
  without rebuilding layout.
- **Editorial / asymmetric** — off-center editorial composition with numbered
  bars, diagonal ball. Most distinctive, highest risk of feeling
  inconsistent with the in-game screens.

## Composition strategy

Both pages share a vertical 3-zone stack anchored to viewport edges:

```
┌──────────────────────────────┐  ← page edge (small gutter only)
│  TOP: brand bar              │  fixed ~64 px
├──────────────────────────────┤
│  MIDDLE: one visual moment   │  ~50% of remaining height
│                              │
├──────────────────────────────┤
│  BOTTOM: title + CTA / card  │  ~50% of remaining height,
│                              │  anchored against the bottom
└──────────────────────────────┘
```

Each zone touches an edge or its neighbor — nothing floats in the middle.
The middle zone's visual is intentionally off-center.

### Spacing rule

All gaps and paddings follow base-8: `8, 16, 24, 32, 48, 64`. Tailwind tokens
used: `gap-2 / gap-4 / gap-6 / gap-8 / gap-12 / gap-16` and the matching
`p-` / `m-` / `space-y-` classes. Banned values: `space-y-5`, `gap-3`,
`gap-5`, `py-2.5`, `p-8` (replace with `p-6`), and any `tracking-[*]`
arbitrary values (use `tracking-wide` or `tracking-widest`).

### Type rule

Two tiers only: **display** and **body**. The current "eyebrow"
(`text-xs uppercase tracking-widest`) is deleted on both pre-auth pages —
it weakens hierarchy as a third tier.

| Role | Mobile | Desktop | Weight |
|---|---|---|---|
| Display title | `text-5xl` (48) | `text-7xl` (72) | `font-extrabold` |
| Brand bar wordmark | `text-sm` (14) | `text-sm` (14) | `font-extrabold tracking-wide` |
| Body | `text-base` (16) | `text-base` (16) | `font-normal text-white/55` |
| Caption | `text-xs` (12) | `text-xs` (12) | `tracking-widest text-white/40` |

### CTA rule

One primary CTA per screen, scaled to its role:

| Screen | Width | Vertical padding | Type |
|---|---|---|---|
| Landing — `GET STARTED` | mobile `w-full`, desktop `w-[420px]` | `py-5` (20) | `text-2xl font-extrabold` |
| Login — `Continue with Google` | `w-full` of card | `py-3` (12) | `text-base font-semibold` |

Secondary affordances (email sign-in, waitlist, back-to-home) become text
links, not buttons.

## Landing page

### Desktop (~1280 × 800)

```
┌─────────────────────────────────────────────────────────┐
│ THE RHYME GAME                              Log in →    │   TOP brand bar
├─────────────────────────────────────────────────────────┤
│                                                         │
│                              ┌────┬────┬────┬─────────┐ │
│                              │    │    │    │  moon   │ │
│                              ├────┼────┼────┼─────────┤ │
│                              │    │    │ ●  │  soon   │ │   MIDDLE — snapshot grid
│                              ├────┼────┼────┼─────────┤ │   bleeds ~16px right edge
│                              │    │    │    │  spree  │ │
│                              ├────┼────┼────┼─────────┤ │
│                              │    │    │    │  free   │ │
│                              └────┴────┴────┴─────────┘ │
│                                       Calm Bap · 88 BPM │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ The Rhyme                                               │
│ Game.                                                   │   BOTTOM left-anchored
│ Beat plays. Ball bounces. Your rhyme lands on time.     │   counter-balances
│                                                         │   right-floating grid
│ [   GET STARTED  →                                  ]   │
└─────────────────────────────────────────────────────────┘
```

### Mobile (390 × 844)

```
┌─────────────────────┐
│ THE RHYME GAME  →   │
├─────────────────────┤
│   ┌──┬──┬──┬─────┐  │
│   │  │  │  │moon │  │
│   ├──┼──┼──┼─────┤  │
│   │  │  │● │soon │  │
│   ├──┼──┼──┼─────┤  │   grid ~88% width,
│   │  │  │  │spree│  │   slight right shift
│   ├──┼──┼──┼─────┤  │
│   │  │  │  │free │  │
│   └──┴──┴──┴─────┘  │
│      Calm Bap·88BPM │
├─────────────────────┤
│ The Rhyme           │
│ Game.               │
│ Beat plays. Ball... │
│                     │
│ [  GET STARTED  → ] │   full-width
└─────────────────────┘
```

### Key changes from current

1. Decorative grid replaced with a `LandingHeroGrid` component — a 4×4
   snapshot of gameplay with real target words in the rightmost column
   (`moon / soon / spree / free`, palette colors
   `#ffd447 / #3aa3ff / #ff8a3c / #e44d4d`). Active row at full opacity,
   others fading. Ball mid-bar in row 2.
2. Grid sits in the right half of the canvas on desktop, bleeding ~16 px
   past the right edge.
3. Title and CTA anchor to the lower-left to counter-balance the
   right-floating grid. Title aligns to the *top* of the bottom zone,
   not centered within it.
4. CTA grows from ~210×60 px to ~420×80 px on desktop; full-width on mobile.
5. Eyebrow "FREESTYLE RAP TRAINER" deleted.
6. Three bottom feature pills (Beat / Rhyme / Flow) deleted entirely.
   The grid-with-words plus the one-line tagline carries the message.
7. Mobile shows the same snapshot grid (no `hidden md:flex`).

## Login page

### Desktop (~1280 × 800)

```
┌─────────────────────────────────────────────────────────┐
│ THE RHYME GAME                                          │   TOP brand bar
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│                    The Rhyme                            │   MIDDLE
│                    Game.                                │   oversized wordmark
│                                                         │   ~text-7xl gradient
│                    ● ● ● ●                              │   4-dot rhythm motif
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              ┌─────────────────────────┐                │
│              │  Sign in                │                │   BOTTOM
│              │  Access by invitation   │                │   card centered, max-w-md
│              │                         │                │
│              │ [ Continue w/ Google  ] │                │   primary
│              │                         │                │
│              │  or use email           │                │   tiny label
│              │  [your@email.com] [→]   │                │   inline single-row email
│              │                         │                │
│              │  Not invited? Join →    │                │   text link, expands form
│              └─────────────────────────┘                │
│                                                         │
│  ← Back to home                                         │   page-level link
└─────────────────────────────────────────────────────────┘
```

### Mobile (390 × 844)

```
┌──────────────────────┐
│ THE RHYME GAME       │
├──────────────────────┤
│   The Rhyme          │
│   Game.              │   wordmark ~text-5xl
│                      │
│   ● ● ● ●            │
├──────────────────────┤
│ Sign in              │
│ Access by invitation │
│                      │
│ [Continue w/ Google] │
│                      │
│ or use email         │
│ [your@email.com]     │   email stacks on mobile
│ [Send link →]        │   for thumb-width input
│                      │
│ Not invited? Join →  │
│                      │
│ ← Back to home       │
└──────────────────────┘
```

### Key changes from current

1. Split-hero deleted. One vertical column.
2. Decorative grid deleted from this page — landing already shows it.
3. Middle zone fills with an oversized brand wordmark (`text-7xl` desktop,
   `text-5xl` mobile) plus a 4-dot motif beneath that echoes the
   landing's 4-column grid without redrawing it. Each dot is `w-2 h-2`
   (8 px) `rounded-full` with `gap-3` between dots; colors run
   `#5ec8ff / #5ec8ff / #2860e0 / #2860e0` for a left-to-right fade
   inside the brand gradient.
4. Auth card collapses from 7 elements to 4: title block, Google button,
   inline email row, waitlist text link.
5. Both `or` dividers are removed; visual size hierarchy between Google
   button and inline email row carries the distinction.
6. Email form uses a new compact `variant="inline"` on desktop —
   `input + arrow-icon button` on a single row. Mobile uses existing
   `variant="stacked"`.
7. Waitlist becomes a text link "Not invited? Join the waitlist →" that
   expands inline into the existing `WaitlistForm`. Removes the dual-form
   stacked-in-same-card pattern.
8. "Back to home" exits the card and lives as a page-level link in the
   lower-left of the page padding.

### Closed-beta variant

`app/login/closed-beta.tsx` mirrors the same shell — same top brand bar,
same oversized wordmark + 4-dot motif in the middle zone, same page-level
"Back to home" link in the lower-left. The auth card swaps to: caption
"Closed beta — private testing", `WaitlistForm` always-expanded as the
primary action (no Google button, no email row, no expand-on-click since
there is no alternative path).

## Spacing & sizing scale

Page-level:

| Token | Mobile | Desktop |
|---|---|---|
| Page horizontal padding | `px-6` (24) | `px-12` (48) |
| Brand bar height | `h-16` (64) | `h-16` (64) |
| Zone separator gap | `gap-8` (32) | `gap-12` (48) |
| Vertical safe inset | `py-8` (32) | `py-12` (48) |

Auth card:

| Property | Value |
|---|---|
| Width (desktop) | `max-w-md` (448) |
| Width (mobile) | `w-full` with `px-6` page gutter |
| Padding | `p-6` (24) — reduced from `p-8` |
| Internal vertical rhythm | `space-y-4` (16) — replaces `space-y-5` |
| Border radius | `rounded-2xl` (16) |
| Background | `bg-[rgba(94,200,255,0.05)]` |
| Border | `border border-[rgba(94,200,255,0.15)]` |

Landing snapshot grid (`LandingHeroGrid`):

| Property | Mobile | Desktop |
|---|---|---|
| Container width | ~88% viewport, slight right shift | ~520 px, bleeds 16 px past right edge |
| Cell height | `h-12` (48) | `h-14` (56) |
| Cell gap | `gap-2` (8) | `gap-2` (8) |
| Cell radius | `rounded-xl` (12) | `rounded-2xl` (16) |
| Rightmost column ratio | ~1.6× other cols | ~2× other cols (room for target word) |
| Row opacities | row 0: 0.4, row 1 (active): 1.0, row 2: 0.55, row 3: 0.25 | same |
| Ball | row 1, col 2 center, 12 px circle | row 1, col 2 center, 16 px circle |

## Implementation outline

### New files

- `components/LandingHeroGrid.tsx` — static 4×4 grid, no state, no animation.
  ~80 LOC. Optional `targets?: string[]` prop, defaults to
  `['moon','soon','spree','free']`.
- `components/LandingHeroGrid.test.tsx` — snapshot test asserting 4 rows ×
  4 cols, target words present in rightmost column, ball element in row 1.

### Modified files

| File | Change |
|---|---|
| `app/page.tsx` | Replace hero split + feature pills with 3-zone stack. Drop inline `GRID_CELLS` / `CELL_CLASS` constants. Title left-anchored within bottom zone. CTA `text-2xl py-5 w-full md:w-[420px]`. |
| `app/login/login-content.tsx` | Replace `md:grid md:grid-cols-2` with vertical 3-zone stack. Add oversized centered wordmark + 4-dot motif as middle zone. Streamline card to 4 elements. Track `showWaitlist` state to expand `WaitlistForm` on click. Move "Back to home" outside the card. |
| `app/login/closed-beta.tsx` | Match new shell. Card swaps to: caption, expanded `WaitlistForm` as primary, no Google. |
| `app/login/email-signin-form.tsx` | Add `variant?: 'inline' \| 'stacked'` prop. `inline` renders input + arrow-icon button on one row (`flex gap-2`, input `flex-1`, button fixed-width). Default = `stacked`. |
| `app/login/email-signin-form.test.tsx` | Add test for `variant="inline"` rendering. |

### Files left alone

- All `components/` except `LandingHeroGrid.tsx`.
- `app/play/`, `app/api/`, `auth.*`, `middleware.ts`, `lib/`, `hooks/`.
- `tailwind.config.ts` — no new tokens.
- `app/globals.css` — no changes.

## Out of scope

- Setup screen, Play screen, End screen, Calibrate flow, YT setup flow.
- Live game preview on landing (Approach A — deferred).
- New colors, fonts, or component primitives.
- Dark/light theming.
- Audio previews on pre-auth pages.

## Open questions to resolve during implementation

1. **Target words on landing snapshot.** `moon / soon / spree / free` is a
   placeholder. Once implementation is in, decide whether to rotate words
   on each page load, hard-code, or read from the same source as the
   actual rhyme prompts. First pass: hard-coded.
2. **Expand-on-click waitlist animation.** First pass: no animation, just
   conditional render. Framer-motion fade can land in a follow-up.
3. **`Calm Bap · 88 BPM` caption.** Currently hard-coded on landing. Could
   become dynamic (read the default beat from `lib/beats.ts`). Out of scope
   for this redesign — keep as-is or hard-code the same string.
