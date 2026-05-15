# Login Page Desktop Layout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-column desktop layout to the login page so it makes full use of horizontal space at `md:` (768px+), while leaving mobile unchanged.

**Scope:** `app/login/page.tsx` only. The landing page (`app/page.tsx`) already has a desktop layout and is not touched.

---

## Design

### Mobile (unchanged)
Centered `max-w-sm` card with nav bar above. Exactly as it is today.

### Desktop (`md:` breakpoint)

The page body below the nav becomes a two-column grid:

```
md:grid-cols-2   h-full
┌──────────────────┬──────────────────┐
│  LEFT: branding  │  RIGHT: auth     │
│                  │                  │
│  label           │   ┌──────────┐   │
│  big title       │   │ Sign in  │   │
│  tagline         │   │          │   │
│  5-row grid      │   │ Google   │   │
│  bpm caption     │   │ ──or──   │   │
│                  │   │ email    │   │
│                  │   │ submit   │   │
│                  │   └──────────┘   │
└──────────────────┴──────────────────┘
```

**Left column — branding:**
- `FREESTYLE RAP TRAINER` — `text-xs uppercase tracking-widest text-[rgba(94,200,255,0.65)]`
- `The Rhyme Game` — large gradient title, same gradient as rest of app (`linear-gradient(135deg,#5ec8ff,#2860e0)`)
- Tagline: "Beat plays. Ball bounces. Your rhyme lands on time." — `text-white/50`
- 5-row decorative game grid, 4 columns, full column width. Row opacities follow `WordGrid`'s `rowOpacity` pattern (active row = 1, rows above/below fade). Row 3 (active) gets a cyan glow ring. Col 4 of each row shows a color chip (yellow, blue, orange, red, red-faded). Col 3 of row 2 shows the orange bouncing ball dot.
- `Calm Bap · 88 BPM` caption — `text-xs text-white/25`
- Right edge: `border-r border-[rgba(94,200,255,0.10)]`

**Right column — auth card:**
- Existing `max-w-sm` card, vertically centered via `flex items-center justify-center`
- No changes to the card's internal markup

### Nav bar
Already works on desktop (flex row). No changes.

## Files

- Modify: `app/login/page.tsx`

## Implementation notes

- The outer `<div className="flex flex-1 items-center justify-center p-6">` becomes `<div className="flex-1 md:grid md:grid-cols-2">`.
- Left column gets `hidden md:flex flex-col justify-center gap-6 px-8 py-12 border-r border-[rgba(94,200,255,0.10)]` — hidden on mobile, shown on desktop.
- Right column gets `flex items-center justify-center p-6` — this is where the existing `max-w-sm` card lives on all screen sizes. On mobile this column is the whole body; on desktop it's the right half.
- The decorative grid is static HTML, no JS. Uses Tailwind `opacity-*` classes to mimic the `rowOpacity` fade: row above active = `opacity-[0.07]`, active = `opacity-100`, row below = `opacity-[0.28]`, further rows fade to `opacity-0`.
- No new components, no new files.
- The `process.env.NODE_ENV === 'development'` dev-login block inside the card is untouched.
