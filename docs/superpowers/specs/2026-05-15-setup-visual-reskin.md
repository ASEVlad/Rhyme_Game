# Setup Screen Visual Reskin — Design Spec

**Date:** 2026-05-15
**Status:** Approved
**Companion spec:** `2026-05-15-setup-ux-redesign.md` (toggle layout + PLAY position)

## Summary

Reskin the Setup screen from the current flat-dark palette (`#080808`, yellow accent `#ffd447`) to an **Ice & Chrome** theme: deep navy-black background with a cyan radial glow bleed, cyan→blue gradient on the title and primary action button, and all controls tinted with the same cyan family at low opacity.

## Scope

This spec covers the **Setup screen only** (`components/Setup.tsx` and `app/globals.css`). It does not restyle the playing screen, end screen, BrowseBeats modal, login page, or `/yt` page — those are out of scope.

## Color tokens

Add two new tokens to `tailwind.config.ts` (existing tokens unchanged):

| Token | Value |
|---|---|
| `rhyme.cyan-from` | `#5ec8ff` |
| `rhyme.cyan-to` | `#2860e0` |

The existing `rhyme.yellow`, `rhyme.blue`, `rhyme.orange`, `rhyme.red` tokens are used by the playing screen and must **not** change. The global `bg` token (`#080808`) and `globals.css` body background are also left untouched — the Setup screen overrides its background on the `<main>` element directly.

## Background

On the Setup `<main>` element, set:

```css
background-color: #060c14;
background-image: radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%);
```

Tailwind equivalent (inline style for the gradient, class for the base color):
```tsx
<main
  className="flex min-h-screen flex-col p-6 bg-[#060c14]"
  style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
>
```

## Title

```tsx
<h1
  className="text-4xl font-extrabold tracking-tight"
  style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
>
  The Rhyme Game
</h1>
```

## PLAY button

Replace `bg-rhyme-yellow text-bg` with the cyan→blue gradient + glow:

```tsx
<button
  className="rounded-2xl px-12 py-5 text-3xl font-extrabold text-[#060c14] disabled:opacity-40"
  style={{
    background: 'linear-gradient(135deg,#5ec8ff,#2860e0)',
    boxShadow: canPlay ? '0 0 32px rgba(94,200,255,0.45)' : 'none',
  }}
>
  PLAY
</button>
```

## Beat source toggle (from companion spec)

Active tab uses the same gradient as PLAY. Container and inactive tab use cyan-tinted opacity:

| Element | Class / style |
|---|---|
| Toggle container | `bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)] rounded-xl p-1 flex gap-1` |
| Active tab | gradient + `box-shadow: 0 0 12px rgba(94,200,255,0.35)` + `text-[#060c14] font-bold` |
| Inactive tab | `bg-transparent text-white/45` |

## Beat picker button

Replace `bg-white/[0.06]` with cyan-tinted equivalents:

```tsx
className="w-full flex items-center justify-between rounded-2xl
  bg-[rgba(94,200,255,0.06)] border border-[rgba(94,200,255,0.14)]
  px-4 py-3 text-left"
```

The `›` chevron color: `text-[rgba(94,200,255,0.5)]`.

## Pickers (Language, Difficulty, RhymeScheme)

All three picker components currently hardcode `bg-rhyme-yellow` / `bg-white/5` for their active/inactive states. Add two props to each:

```ts
type Props = {
  // existing props …
  activeClassName?: string;   // default: current hardcoded active class
  inactiveClassName?: string; // default: current hardcoded inactive class
};
```

`Setup.tsx` passes:
- `activeClassName="rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white"`
- `inactiveClassName="rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60"`

Each picker container row also gets `bg-[rgba(94,200,255,0.04)]` (pass as a `className` prop, or keep it in Setup by wrapping the picker in a styled div). The simplest path: add a `className` prop to each picker container `<div>` and pass `"rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3"` from Setup.

## Divider

```tsx
<div className="border-t border-[rgba(94,200,255,0.10)] my-1" />
```

## Log out button

No style change in this spec — remains `text-white/60 hover:text-white`. Tinting it cyan is a possible future improvement but out of scope here.

## YouTube URL input (YouTube tab)

When `beatSource === 'youtube'`, the URL input border uses the cyan family:

```tsx
className="flex-1 rounded-xl bg-[rgba(94,200,255,0.06)] border border-[rgba(94,200,255,0.30)]
  px-3 py-2 text-sm placeholder:text-white/40 outline-none disabled:opacity-40"
```

Load button (YouTube tab): same gradient as PLAY, smaller:
```tsx
className="rounded-xl px-3 py-2 text-sm font-bold text-[#060c14] disabled:opacity-40"
style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
```

## Catalog rows (YouTube tab)

Selected catalog row: `bg-[rgba(94,200,255,0.12)] border border-[rgba(94,200,255,0.25)]`

Unselected catalog row: `bg-[rgba(94,200,255,0.04)] hover:bg-[rgba(94,200,255,0.08)]`

"Recent" label: `text-[rgba(94,200,255,0.45)] uppercase tracking-wider text-[10px]`

## What does NOT change

- `tailwind.config.ts` `rhyme.*` color tokens (used by playing screen)
- `globals.css` body background (stays `#080808` for other screens)
- `BrowseBeats.tsx` — untouched
- `WordGrid.tsx`, `BouncingBall.tsx`, `EndScreen.tsx`, `Game.tsx` — untouched
- `YtSetup.tsx`, `YtLoadingState.tsx`, `YtGame.tsx` — untouched
- Login page — untouched
