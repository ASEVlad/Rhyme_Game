# Римова Гра Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Ukrainian-language web clone of The Rhyme Game's Classic mode — a freestyle-rap scaffolding tool gated by a shared password, with rhyme groups generated per session via the Claude API.

**Architecture:** Single Next.js 14 (App Router) repo deployed to Vercel. Server-side API routes for login (HMAC-signed cookie auth) and rhyme generation (Anthropic SDK with tool-use). Client renders a 4×N grid with a bouncing ball animation timed against the bundled beat's `audio.currentTime`. No database; auth state is a signed cookie, game state is in-memory only.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Vitest (unit tests), `@anthropic-ai/sdk`, Manrope font via `next/font/google`.

**Reference spec:** `docs/superpowers/specs/2026-05-06-rhyme-game-design.md`

---

## File map

```
app/
  layout.tsx                # font, global styles, base background
  page.tsx                  # auth-gated game shell — renders <Game />
  login/page.tsx            # password form (client component)
  api/login/route.ts        # POST: verify password, set cookie
  api/logout/route.ts       # POST: clear cookie
  api/rhymes/route.ts       # POST: call Claude → return groups (or fallback)
components/
  Setup.tsx                 # ГРАТИ button + BeatPicker + Вийти link
  Game.tsx                  # state machine: setup ⇄ loading ⇄ playing ⇄ ended
  WordGrid.tsx              # 4×N grid with active-row highlight
  BouncingBall.tsx          # ball element + trail
  BeatPicker.tsx            # ◀ track name (BPM) ▶
  EndScreen.tsx             # "Гарна робота!" + Грати знову / Інший біт
hooks/
  useBeat.ts                # wraps <audio>; play / pause / seek / currentTime
  useGameLoop.ts            # rAF; uses session-time + bpm → emits {ballX, currentBar, beatInBar}
lib/
  auth.ts                   # signCookie / verifyCookie (HMAC-SHA256)
  rhymes.ts                 # fetchRhymeGroups() — Claude tool-use + fallback
  fallback-groups.ts        # ~12 hardcoded Ukrainian rhyme groups
  beats.ts                  # static metadata for bundled beats
  flatten-bars.ts           # groups → ordered array of bars
  session-time.ts           # pure: makeSessionTimer(audio) handles loop wraparound
  colors.ts                 # rhyme-group color rotation
public/
  beats/                    # 8–10 .mp3 files (added in Task 12)
middleware.ts               # auth gate — redirects to /login when cookie missing/bad
```

Tests are colocated as `<file>.test.ts` next to the source.

---

## Task 1: Project bootstrap

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `vitest.config.ts`, `.gitignore`, `.env.example`

- [ ] **Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "rhyme-game",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules` populated, `package-lock.json` created, no errors.

- [ ] **Step 3: TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Next.js config**

Create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
};
```

- [ ] **Step 5: Tailwind config**

Create `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0e1330',
        rhyme: {
          yellow: '#ffd447',
          blue:   '#3aa3ff',
          orange: '#ff8a3c',
          red:    '#e44d4d',
        },
        ball: '#ff9d2a',
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

Create `postcss.config.mjs`:

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 6: Global stylesheet**

Create `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body { background: #0e1330; color: white; min-height: 100%; }
body { font-family: var(--font-manrope), system-ui, sans-serif; }
```

- [ ] **Step 7: Root layout with Manrope font**

Create `app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '600', '800'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'Римова Гра',
  description: 'Українська гра для тренування фристайлу',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Stub home page**

Create `app/page.tsx`:

```tsx
export default function Page() {
  return <main className="p-8 text-2xl">Римова Гра — coming soon</main>;
}
```

- [ ] **Step 9: Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
});
```

- [ ] **Step 10: .gitignore + .env.example**

Create `.gitignore`:

```
node_modules
.next
.env
.env.local
.DS_Store
*.log
```

Create `.env.example`:

```
APP_PASSWORD=change-me
AUTH_SECRET=generate-with-openssl-rand-hex-32
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 11: Smoke test the dev server**

Run: `npm run dev`
Expected: starts on http://localhost:3000, page shows "Римова Гра — coming soon", no console errors. Stop server with Ctrl+C.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs vitest.config.ts .gitignore .env.example app
git commit -m "chore: bootstrap Next.js + Tailwind + Vitest"
```

---

## Task 2: Cookie auth library (TDD)

**Files:**
- Create: `lib/auth.ts`, `lib/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { signCookie, verifyCookie } from './auth';

const SECRET = 'test-secret-key-do-not-use-in-prod';

describe('auth', () => {
  it('roundtrips a fresh cookie', () => {
    const cookie = signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const result = verifyCookie(cookie, SECRET);
    expect(result.valid).toBe(true);
  });

  it('rejects an expired cookie', () => {
    const cookie = signCookie({ exp: Date.now() - 1000 }, SECRET);
    const result = verifyCookie(cookie, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('rejects a cookie signed with a different secret', () => {
    const cookie = signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const result = verifyCookie(cookie, 'other-secret');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_signature');
  });

  it('rejects a tampered cookie', () => {
    const cookie = signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const tampered = cookie.slice(0, -2) + 'XX';
    const result = verifyCookie(tampered, SECRET);
    expect(result.valid).toBe(false);
  });

  it('rejects a malformed cookie', () => {
    expect(verifyCookie('garbage', SECRET).valid).toBe(false);
    expect(verifyCookie('', SECRET).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth`
Expected: FAIL — module not found / cannot import `signCookie`.

- [ ] **Step 3: Implement auth.ts**

Create `lib/auth.ts`:

```ts
import { createHmac, timingSafeEqual } from 'crypto';

export type CookiePayload = { exp: number };

export type VerifyResult =
  | { valid: true; payload: CookiePayload }
  | { valid: false; reason: 'malformed' | 'bad_signature' | 'expired' };

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function hmac(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

export function signCookie(payload: CookiePayload, secret: string): string {
  const payloadStr = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(hmac(payloadStr, secret));
  return `${payloadStr}.${sig}`;
}

export function verifyCookie(cookie: string, secret: string): VerifyResult {
  if (!cookie || typeof cookie !== 'string') return { valid: false, reason: 'malformed' };
  const parts = cookie.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [payloadStr, sigStr] = parts;
  const expectedSig = hmac(payloadStr, secret);
  let providedSig: Buffer;
  try {
    providedSig = fromB64url(sigStr);
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (providedSig.length !== expectedSig.length) return { valid: false, reason: 'bad_signature' };
  if (!timingSafeEqual(providedSig, expectedSig)) return { valid: false, reason: 'bad_signature' };
  let payload: CookiePayload;
  try {
    payload = JSON.parse(fromB64url(payloadStr).toString('utf8'));
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, payload };
}

export const COOKIE_NAME = 'rg_auth';
export const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days
```

- [ ] **Step 4: Run tests**

Run: `npm test -- auth`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts
git commit -m "feat(auth): HMAC-signed cookie sign/verify"
```

---

## Task 3: Login + logout API routes

**Files:**
- Create: `app/api/login/route.ts`, `app/api/logout/route.ts`

- [ ] **Step 1: Implement /api/login**

Create `app/api/login/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { signCookie, COOKIE_NAME, COOKIE_MAX_AGE_S } from '@/lib/auth';

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!expected || !secret) {
    return NextResponse.json({ error: 'server-misconfigured' }, { status: 500 });
  }
  if (typeof password !== 'string' || !safeEq(password, expected)) {
    return NextResponse.json({ error: 'invalid-password' }, { status: 401 });
  }
  const cookie = signCookie({ exp: Date.now() + COOKIE_MAX_AGE_S * 1000 }, secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_S,
    path: '/',
  });
  return res;
}
```

- [ ] **Step 2: Implement /api/logout**

Create `app/api/logout/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}
```

- [ ] **Step 3: Manual smoke test**

Set env vars in `.env.local`:

```
APP_PASSWORD=test123
AUTH_SECRET=test-secret-32-chars-min-please-pad
ANTHROPIC_API_KEY=placeholder
```

Run: `npm run dev`
In another terminal:

```bash
curl -i -X POST http://localhost:3000/api/login -H 'content-type: application/json' -d '{"password":"wrong"}'
# Expect: 401, no Set-Cookie

curl -i -X POST http://localhost:3000/api/login -H 'content-type: application/json' -d '{"password":"test123"}'
# Expect: 200, Set-Cookie: rg_auth=...

curl -i -X POST http://localhost:3000/api/logout
# Expect: 200, Set-Cookie: rg_auth=; Max-Age=0
```

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/api
git commit -m "feat(auth): /api/login and /api/logout routes"
```

---

## Task 4: Auth middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Implement middleware**

Create `middleware.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/login'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (pathname.startsWith('/_next') || pathname.startsWith('/beats') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!secret || !cookie) {
    return redirectToLogin(req);
  }
  const result = verifyCookie(cookie, secret);
  if (!result.valid) {
    const res = redirectToLogin(req);
    res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
    return res;
  }
  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`
In a browser: open http://localhost:3000 → should redirect to `/login` (which 404s — login page comes in Task 5; the redirect itself is what we're verifying).

In a terminal:

```bash
# without cookie → expect redirect
curl -i http://localhost:3000/
# expect 307 with Location: /login
```

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): middleware redirects unauthenticated requests to /login"
```

---

## Task 5: Login page

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Implement login page**

Create `app/login/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Неправильний пароль');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-extrabold text-center">Римова Гра</h1>
        <p className="text-center text-white/60">Введіть пароль</p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-lg outline-none focus:bg-white/15"
          placeholder="Пароль"
        />
        {error && <p className="text-rhyme-red text-center">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full rounded-xl bg-rhyme-yellow text-bg font-bold py-3 text-lg disabled:opacity-50"
        >
          {submitting ? 'Перевірка...' : 'Увійти'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Manual smoke test the auth loop end-to-end**

Run: `npm run dev`
1. Open http://localhost:3000 — redirected to /login
2. Type wrong password, submit — see "Неправильний пароль"
3. Type correct password (`test123`), submit — redirected to / which shows the stub
4. Refresh / — still works (cookie persists)
5. Open DevTools → Application → Cookies → delete `rg_auth` → reload `/` — back to /login

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/login
git commit -m "feat(auth): login page with password form"
```

---

## Task 6: Fallback rhyme groups

**Files:**
- Create: `lib/fallback-groups.ts`

- [ ] **Step 1: Implement fallback groups**

Create `lib/fallback-groups.ts`:

```ts
export type RhymeGroup = { ending: string; words: string[] };

export const FALLBACK_GROUPS: RhymeGroup[] = [
  { ending: '-іт',   words: ['кіт', 'літ', 'піт', 'квіт'] },
  { ending: '-ата',  words: ['хата', 'лата', 'вата', 'брата'] },
  { ending: '-ить',  words: ['летить', 'горить', 'болить', 'бубонить'] },
  { ending: '-ова',  words: ['нова', 'голова', 'основа', 'розмова'] },
  { ending: '-ина',  words: ['калина', 'малина', 'людина', 'хвилина'] },
  { ending: '-ого',  words: ['нового', 'білого', 'великого', 'малого'] },
  { ending: '-ить',  words: ['кричить', 'мовчить', 'дзвенить', 'грає'] },
  { ending: '-ення', words: ['рішення', 'значення', 'порушення', 'зменшення'] },
  { ending: '-уть',  words: ['ідуть', 'несуть', 'кують', 'пасуть'] },
  { ending: '-але',  words: ['було', 'мало', 'стало', 'пропало'] },
  { ending: '-есь',  words: ['радість', 'свіжість', 'юність', 'ніжність'] },
  { ending: '-ера',  words: ['віра', 'міра', 'сира', 'дітвора'] },
];
```

(Note for the implementer: these are starter words — feel free to refine if you spot a non-rhyme; the LLM path is the primary content source, this just keeps the app working when the API fails.)

- [ ] **Step 2: Commit**

```bash
git add lib/fallback-groups.ts
git commit -m "feat(rhymes): bundled fallback rhyme groups"
```

---

## Task 7: flatten-bars utility (TDD)

**Files:**
- Create: `lib/colors.ts`, `lib/flatten-bars.ts`, `lib/flatten-bars.test.ts`

- [ ] **Step 1: Implement colors module**

Create `lib/colors.ts`:

```ts
export const RHYME_COLORS = ['yellow', 'blue', 'orange', 'red'] as const;
export type RhymeColor = typeof RHYME_COLORS[number];
```

- [ ] **Step 2: Write the failing test**

Create `lib/flatten-bars.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { flattenBars } from './flatten-bars';

describe('flattenBars', () => {
  it('produces one bar per word, preserving order', () => {
    const groups = [
      { ending: '-ox', words: ['fox', 'box'] },
      { ending: '-ent', words: ['bent', 'tent'] },
    ];
    const bars = flattenBars(groups);
    expect(bars.map(b => b.word)).toEqual(['fox', 'box', 'bent', 'tent']);
  });

  it('assigns colors per group, round-robin', () => {
    const groups = [
      { ending: 'a', words: ['a1'] },
      { ending: 'b', words: ['b1'] },
      { ending: 'c', words: ['c1'] },
      { ending: 'd', words: ['d1'] },
      { ending: 'e', words: ['e1'] },
    ];
    const bars = flattenBars(groups);
    expect(bars.map(b => b.color)).toEqual(['yellow', 'blue', 'orange', 'red', 'yellow']);
  });

  it('keeps groupIndex consistent within a group', () => {
    const groups = [{ ending: 'a', words: ['x', 'y', 'z'] }];
    const bars = flattenBars(groups);
    expect(bars.map(b => b.groupIndex)).toEqual([0, 0, 0]);
  });

  it('returns empty array for empty input', () => {
    expect(flattenBars([])).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- flatten-bars`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement flattenBars**

Create `lib/flatten-bars.ts`:

```ts
import type { RhymeGroup } from './fallback-groups';
import { RHYME_COLORS, type RhymeColor } from './colors';

export type Bar = {
  word: string;
  color: RhymeColor;
  groupIndex: number;
};

export function flattenBars(groups: RhymeGroup[]): Bar[] {
  const bars: Bar[] = [];
  groups.forEach((g, i) => {
    const color = RHYME_COLORS[i % RHYME_COLORS.length];
    g.words.forEach(word => bars.push({ word, color, groupIndex: i }));
  });
  return bars;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- flatten-bars`
Expected: all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/colors.ts lib/flatten-bars.ts lib/flatten-bars.test.ts
git commit -m "feat(rhymes): flattenBars + color rotation"
```

---

## Task 8: Rhymes library — Claude tool-use + fallback (TDD)

**Files:**
- Create: `lib/rhymes.ts`, `lib/rhymes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/rhymes.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchRhymeGroups } from './rhymes';
import { FALLBACK_GROUPS } from './fallback-groups';

function mockClient(behavior: 'good' | 'malformed' | 'throws' | 'empty') {
  return {
    messages: {
      create: vi.fn(async () => {
        if (behavior === 'throws') throw new Error('network down');
        if (behavior === 'malformed') {
          return { content: [{ type: 'text', text: 'not json' }] };
        }
        if (behavior === 'empty') {
          return {
            content: [
              { type: 'tool_use', name: 'rhyme_groups', input: { groups: [] } },
            ],
          };
        }
        return {
          content: [
            {
              type: 'tool_use',
              name: 'rhyme_groups',
              input: {
                groups: [
                  { ending: '-іт', words: ['кіт', 'літ', 'піт'] },
                  { ending: '-ата', words: ['хата', 'лата'] },
                ],
              },
            },
          ],
        };
      }),
    },
  } as any;
}

describe('fetchRhymeGroups', () => {
  it('returns groups from a successful tool-use response', async () => {
    const groups = await fetchRhymeGroups({ count: 2, client: mockClient('good') });
    expect(groups).toEqual([
      { ending: '-іт', words: ['кіт', 'літ', 'піт'] },
      { ending: '-ата', words: ['хата', 'лата'] },
    ]);
  });

  it('falls back when the API throws', async () => {
    const groups = await fetchRhymeGroups({ count: 2, client: mockClient('throws') });
    expect(groups).toEqual(FALLBACK_GROUPS);
  });

  it('falls back when no tool-use block is returned', async () => {
    const groups = await fetchRhymeGroups({ count: 2, client: mockClient('malformed') });
    expect(groups).toEqual(FALLBACK_GROUPS);
  });

  it('falls back when groups array is empty', async () => {
    const groups = await fetchRhymeGroups({ count: 2, client: mockClient('empty') });
    expect(groups).toEqual(FALLBACK_GROUPS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rhymes`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement fetchRhymeGroups**

Create `lib/rhymes.ts`:

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { FALLBACK_GROUPS, type RhymeGroup } from './fallback-groups';

const TOOL_NAME = 'rhyme_groups';

const TOOL = {
  name: TOOL_NAME,
  description: 'Return groups of common Ukrainian words that rhyme.',
  input_schema: {
    type: 'object' as const,
    properties: {
      groups: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ending: { type: 'string', description: 'Shared ending (e.g. "-іт")' },
            words: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 5,
            },
          },
          required: ['ending', 'words'],
        },
      },
    },
    required: ['groups'],
  },
};

export type FetchOpts = {
  count?: number;
  client?: Pick<Anthropic, 'messages'>;
};

function buildPrompt(count: number): string {
  return [
    `Згенеруй ${count} груп поширених українських слів, які римуються між собою.`,
    'Кожна група повинна мати спільне закінчення (від наголошеного голосного до кінця слова).',
    'У кожній групі — 3–4 слова. Уникай рідкісних, архаїчних або вульгарних слів.',
    'Перевага — простим іменникам, дієсловам та прикметникам, які впізнає підліток або початківець.',
    'Виведи результат через інструмент rhyme_groups.',
  ].join(' ');
}

function parseGroups(content: unknown): RhymeGroup[] | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && typeof block === 'object' && (block as any).type === 'tool_use' && (block as any).name === TOOL_NAME) {
      const groups = (block as any).input?.groups;
      if (!Array.isArray(groups)) return null;
      const cleaned: RhymeGroup[] = [];
      for (const g of groups) {
        if (!g || typeof g.ending !== 'string') continue;
        if (!Array.isArray(g.words)) continue;
        const words = g.words.filter((w: unknown) => typeof w === 'string' && w.length > 0);
        if (words.length >= 2) cleaned.push({ ending: g.ending, words });
      }
      return cleaned.length ? cleaned : null;
    }
  }
  return null;
}

export async function fetchRhymeGroups(opts: FetchOpts = {}): Promise<RhymeGroup[]> {
  const count = opts.count ?? 10;
  const client = opts.client;
  if (!client) return FALLBACK_GROUPS;
  try {
    const response: any = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: buildPrompt(count) }],
    });
    const parsed = parseGroups(response?.content);
    return parsed ?? FALLBACK_GROUPS;
  } catch (err) {
    console.error('[rhymes] fetch failed, using fallback', err);
    return FALLBACK_GROUPS;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- rhymes`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rhymes.ts lib/rhymes.test.ts
git commit -m "feat(rhymes): fetchRhymeGroups via Claude tool-use with fallback"
```

---

## Task 9: /api/rhymes route

**Files:**
- Create: `app/api/rhymes/route.ts`

- [ ] **Step 1: Implement the route**

Create `app/api/rhymes/route.ts`:

```ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchRhymeGroups } from '@/lib/rhymes';
import { flattenBars } from '@/lib/flatten-bars';

export const runtime = 'nodejs';

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const client = apiKey ? new Anthropic({ apiKey }) : undefined;
  const groups = await fetchRhymeGroups({ count: 10, client });
  const bars = flattenBars(groups);
  return NextResponse.json({ groups, bars });
}
```

- [ ] **Step 2: Manual smoke test**

Make sure `.env.local` has all three vars set (use a real Anthropic key or leave it as `placeholder` and verify fallback path).

Run: `npm run dev`

Get an auth cookie first (login via curl, copy the cookie):

```bash
COOKIE=$(curl -s -i -X POST http://localhost:3000/api/login \
  -H 'content-type: application/json' -d '{"password":"test123"}' \
  | grep -i 'set-cookie:' | head -1 | sed 's/.*: //; s/;.*//')

curl -s -X POST http://localhost:3000/api/rhymes -H "cookie: $COOKIE" | head -c 600
```

Expected: JSON with `{ groups: [...], bars: [...] }`. With placeholder API key, fallback groups are returned. With a real key, fresh groups.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/api/rhymes
git commit -m "feat(rhymes): /api/rhymes route returns groups+bars"
```

---

## Task 10: Bundled beats metadata

**Files:**
- Create: `lib/beats.ts`, `public/beats/.gitkeep`

- [ ] **Step 1: Implement beats.ts as a typed array**

Create `lib/beats.ts`:

```ts
export type Beat = {
  id: string;
  src: string;          // path under /public, e.g. /beats/calm-bap.mp3
  title: string;
  bpm: number;          // derived from real file duration, see spec
  barsPerLoop: number;  // 8 or 16 typically
};

export const BEATS: Beat[] = [
  // Filled in once .mp3 files are dropped into public/beats/.
  // Until then, this array is empty and the UI falls back to a metronome.
];

export function pickBeat(id: string | undefined): Beat | undefined {
  if (!id) return BEATS[0];
  return BEATS.find(b => b.id === id) ?? BEATS[0];
}
```

- [ ] **Step 2: Create the beats directory**

```bash
mkdir -p public/beats
touch public/beats/.gitkeep
```

(The implementer drops 8–10 royalty-free `.mp3` files into `public/beats/` before going live. They must populate `BEATS` with `bpm` derived from each file's actual duration: `bpm = barsPerLoop × 4 × 60 / audioDurationSeconds`. Pixabay, FreePD, and Free Music Archive are good sources.)

- [ ] **Step 3: Commit**

```bash
git add lib/beats.ts public/beats/.gitkeep
git commit -m "feat(beats): metadata module + public/beats placeholder"
```

---

## Task 11: session-time pure function (TDD)

**Files:**
- Create: `lib/session-time.ts`, `lib/session-time.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/session-time.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeSessionTimer, type AudioLike } from './session-time';

function fakeAudio(initial: number, duration: number): AudioLike & { _t: number } {
  return { currentTime: initial, duration, _t: initial };
}

describe('makeSessionTimer', () => {
  it('returns audio.currentTime when no loops have happened', () => {
    const a = fakeAudio(0, 30);
    const sessionTime = makeSessionTimer(a);
    a.currentTime = 5;
    expect(sessionTime()).toBe(5);
    a.currentTime = 12.5;
    expect(sessionTime()).toBe(12.5);
  });

  it('detects a loop wraparound and adds duration', () => {
    const a = fakeAudio(0, 30);
    const sessionTime = makeSessionTimer(a);
    a.currentTime = 25;
    expect(sessionTime()).toBe(25);
    // looped back
    a.currentTime = 0.5;
    expect(sessionTime()).toBe(30 + 0.5);
  });

  it('handles multiple loops', () => {
    const a = fakeAudio(0, 10);
    const sessionTime = makeSessionTimer(a);
    a.currentTime = 9; sessionTime();
    a.currentTime = 0.1; sessionTime(); // 1st loop
    a.currentTime = 9.5; sessionTime();
    a.currentTime = 0.2; expect(sessionTime()).toBe(20.2); // 2nd loop
  });

  it('does not flag tiny dips as loops', () => {
    const a = fakeAudio(0, 30);
    const sessionTime = makeSessionTimer(a);
    a.currentTime = 12.3; sessionTime();
    a.currentTime = 12.299; // jitter
    expect(sessionTime()).toBe(12.299); // no loop added
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- session-time`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement makeSessionTimer**

Create `lib/session-time.ts`:

```ts
export type AudioLike = { currentTime: number; duration: number };

export function makeSessionTimer(audio: AudioLike): () => number {
  let loops = 0;
  let lastT = audio.currentTime;
  return () => {
    const t = audio.currentTime;
    // Treat a drop of more than half a second as a wraparound; smaller drops are jitter.
    if (t < lastT - 0.5) loops += 1;
    lastT = t;
    const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    return loops * dur + t;
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- session-time`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/session-time.ts lib/session-time.test.ts
git commit -m "feat(timing): makeSessionTimer handles audio loop wraparound"
```

---

## Task 12: useBeat hook

**Files:**
- Create: `hooks/useBeat.ts`

- [ ] **Step 1: Implement the hook**

Create `hooks/useBeat.ts`:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';
import type { Beat } from '@/lib/beats';

export type BeatHandle = {
  audio: HTMLAudioElement | null;
  isReady: boolean;
  isPlaying: boolean;
  error: string | null;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
};

export function useBeat(beat: Beat | undefined): BeatHandle {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setReady] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReady(false);
    setError(null);
    setPlaying(false);
    if (!beat) {
      audioRef.current = null;
      return;
    }
    const a = new Audio(beat.src);
    a.loop = true;
    a.preload = 'auto';
    const onCanPlay = () => setReady(true);
    const onError = () => setError('Не вдалося завантажити біт');
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('canplaythrough', onCanPlay);
    a.addEventListener('error', onError);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    audioRef.current = a;
    return () => {
      a.pause();
      a.removeEventListener('canplaythrough', onCanPlay);
      a.removeEventListener('error', onError);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      audioRef.current = null;
    };
  }, [beat?.src]);

  return {
    audio: audioRef.current,
    isReady,
    isPlaying,
    error,
    play: async () => {
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = 0;
      await a.play();
    },
    pause: () => audioRef.current?.pause(),
    stop: () => {
      const a = audioRef.current;
      if (!a) return;
      a.pause();
      a.currentTime = 0;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useBeat.ts
git commit -m "feat(audio): useBeat hook wrapping <audio loop>"
```

---

## Task 13: useGameLoop hook

**Files:**
- Create: `hooks/useGameLoop.ts`

- [ ] **Step 1: Implement the hook**

Create `hooks/useGameLoop.ts`:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { makeSessionTimer } from '@/lib/session-time';

export type GameTick = {
  ballX: number;        // 0..1 across the 4 cells of the active row
  ballYDip: number;     // 0..1, sine bounce
  currentBar: number;   // 0..totalBars (counts up)
  beatInBar: number;    // 0..4 (continuous)
};

export function useGameLoop(args: {
  audio: HTMLAudioElement | null;
  bpm: number;
  totalBars: number;
  active: boolean;
  onEnd: () => void;
}): GameTick {
  const { audio, bpm, totalBars, active, onEnd } = args;
  const [tick, setTick] = useState<GameTick>({ ballX: 0, ballYDip: 0, currentBar: 0, beatInBar: 0 });
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!active || !audio) return;
    const sessionTime = makeSessionTimer(audio);
    let raf = 0;
    let ended = false;
    const beatsPerSecond = bpm / 60;

    const frame = () => {
      const t = sessionTime();
      const currentBeat = t * beatsPerSecond;
      const currentBar = Math.floor(currentBeat / 4);
      const beatInBar = currentBeat % 4;
      const ballX = beatInBar / 4;
      // Sine dip — ball is "lower" between beats, "higher" on each beat.
      const phase = (beatInBar % 1) * Math.PI;
      const ballYDip = Math.sin(phase);
      setTick({ ballX, ballYDip, currentBar, beatInBar });
      if (currentBar >= totalBars && !ended) {
        ended = true;
        onEndRef.current();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, audio, bpm, totalBars]);

  return tick;
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useGameLoop.ts
git commit -m "feat(game): useGameLoop with rAF + audio-locked timing"
```

---

## Task 14: BouncingBall component

**Files:**
- Create: `components/BouncingBall.tsx`

- [ ] **Step 1: Implement the component**

Create `components/BouncingBall.tsx`:

```tsx
'use client';

type Props = {
  /** 0..1 across the row */
  x: number;
  /** 0..1, dip amount; we render lower when ballYDip is high */
  yDip: number;
};

export function BouncingBall({ x, yDip }: Props) {
  const left = `${x * 100}%`;
  const dipPx = (1 - yDip) * 28; // up to 28px lift on the beat
  return (
    <div className="relative h-16 w-full">
      <div
        className="absolute h-7 w-7 rounded-full bg-ball shadow-[0_0_24px_rgba(255,157,42,0.6)] -translate-x-1/2"
        style={{ left, bottom: `${dipPx}px`, transition: 'background 120ms' }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/BouncingBall.tsx
git commit -m "feat(ui): BouncingBall component"
```

---

## Task 15: WordGrid component

**Files:**
- Create: `components/WordGrid.tsx`

- [ ] **Step 1: Implement the component**

Create `components/WordGrid.tsx`:

```tsx
'use client';

import type { Bar } from '@/lib/flatten-bars';
import type { RhymeColor } from '@/lib/colors';

const COLOR_BG: Record<RhymeColor, string> = {
  yellow: 'bg-rhyme-yellow text-bg',
  blue:   'bg-rhyme-blue text-white',
  orange: 'bg-rhyme-orange text-white',
  red:    'bg-rhyme-red text-white',
};

type Props = {
  bars: Bar[];
  /** index into bars[] currently being played */
  activeRow: number;
  /** ballX 0..1 — used to highlight the active cell */
  ballX: number;
  /** how many rows to show above and below the active one */
  windowSize?: number;
};

export function WordGrid({ bars, activeRow, ballX, windowSize = 4 }: Props) {
  const start = activeRow - 1;
  const end = activeRow + windowSize;
  const visibleRows: Array<{ index: number; bar: Bar | null }> = [];
  for (let i = start; i <= end; i++) {
    visibleRows.push({ index: i, bar: bars[i] ?? null });
  }
  const activeCol = Math.min(3, Math.floor(ballX * 4));

  return (
    <div className="space-y-2 select-none">
      {visibleRows.map(({ index, bar }) => {
        const isActive = index === activeRow;
        return (
          <div key={index} className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(col => {
              const isWordCell = col === 3;
              const cellActive = isActive && col === activeCol;
              if (isWordCell && bar) {
                return (
                  <div
                    key={col}
                    className={[
                      'rounded-xl py-4 text-center text-xl font-bold',
                      COLOR_BG[bar.color],
                      isActive ? 'ring-2 ring-white/70' : 'opacity-90',
                    ].join(' ')}
                  >
                    {bar.word}
                  </div>
                );
              }
              return (
                <div
                  key={col}
                  className={[
                    'rounded-xl py-4',
                    cellActive ? 'bg-white/20' : 'bg-white/[0.06]',
                  ].join(' ')}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/WordGrid.tsx
git commit -m "feat(ui): WordGrid with active-row + active-cell highlight"
```

---

## Task 16: BeatPicker component

**Files:**
- Create: `components/BeatPicker.tsx`

- [ ] **Step 1: Implement the component**

Create `components/BeatPicker.tsx`:

```tsx
'use client';

import type { Beat } from '@/lib/beats';

type Props = {
  beats: Beat[];
  selectedId: string | null;
  onChange: (id: string) => void;
};

export function BeatPicker({ beats, selectedId, onChange }: Props) {
  if (beats.length === 0) {
    return <div className="text-white/60 text-center">Біти ще не додано</div>;
  }
  const idx = Math.max(0, beats.findIndex(b => b.id === selectedId));
  const current = beats[idx];
  const prev = () => onChange(beats[(idx - 1 + beats.length) % beats.length].id);
  const next = () => onChange(beats[(idx + 1) % beats.length].id);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-3">
      <button onClick={prev} aria-label="Попередній біт"
              className="h-10 w-10 rounded-full bg-white/10 text-xl">◀</button>
      <div className="text-center">
        <div className="font-bold">{current.title}</div>
        <div className="text-white/60 text-sm">{current.bpm.toFixed(1)} BPM</div>
      </div>
      <button onClick={next} aria-label="Наступний біт"
              className="h-10 w-10 rounded-full bg-white/10 text-xl">▶</button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/BeatPicker.tsx
git commit -m "feat(ui): BeatPicker"
```

---

## Task 17: Setup component

**Files:**
- Create: `components/Setup.tsx`

- [ ] **Step 1: Implement the component**

Create `components/Setup.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { BEATS } from '@/lib/beats';
import { BeatPicker } from './BeatPicker';

type Props = {
  initialBeatId: string | null;
  onPlay: (beatId: string) => void;
  onLogout: () => void;
};

export function Setup({ initialBeatId, onPlay, onLogout }: Props) {
  const [beatId, setBeatId] = useState<string | null>(initialBeatId ?? BEATS[0]?.id ?? null);
  const canPlay = beatId !== null;
  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex justify-end">
        <button onClick={onLogout} className="text-white/60 hover:text-white">Вийти</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-extrabold">Римова Гра</h1>
        <button
          onClick={() => beatId && onPlay(beatId)}
          disabled={!canPlay}
          className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
        >
          ГРАТИ
        </button>
        <div className="w-full max-w-sm">
          <BeatPicker beats={BEATS} selectedId={beatId} onChange={setBeatId} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Setup.tsx
git commit -m "feat(ui): Setup screen"
```

---

## Task 18: EndScreen component

**Files:**
- Create: `components/EndScreen.tsx`

- [ ] **Step 1: Implement the component**

Create `components/EndScreen.tsx`:

```tsx
'use client';

type Props = {
  onPlayAgain: () => void;
  onChangeBeat: () => void;
};

export function EndScreen({ onPlayAgain, onChangeBeat }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h2 className="text-4xl font-extrabold">Гарна робота!</h2>
      <button
        onClick={onPlayAgain}
        className="rounded-2xl bg-rhyme-yellow px-10 py-4 text-2xl font-bold text-bg"
      >
        Грати знову
      </button>
      <button
        onClick={onChangeBeat}
        className="rounded-2xl bg-white/10 px-10 py-4 text-xl"
      >
        Інший біт
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/EndScreen.tsx
git commit -m "feat(ui): EndScreen"
```

---

## Task 19: Game state machine

**Files:**
- Create: `components/Game.tsx`

- [ ] **Step 1: Implement the state machine**

Create `components/Game.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BEATS, pickBeat } from '@/lib/beats';
import type { Bar } from '@/lib/flatten-bars';
import { useBeat } from '@/hooks/useBeat';
import { useGameLoop } from '@/hooks/useGameLoop';
import { Setup } from './Setup';
import { WordGrid } from './WordGrid';
import { BouncingBall } from './BouncingBall';
import { EndScreen } from './EndScreen';

type Phase = 'setup' | 'loading' | 'playing' | 'ended';

export function Game() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('setup');
  const [beatId, setBeatId] = useState<string | null>(BEATS[0]?.id ?? null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const beat = pickBeat(beatId ?? undefined);
  const beatHandle = useBeat(beat);

  const tick = useGameLoop({
    audio: phase === 'playing' ? beatHandle.audio : null,
    bpm: beat?.bpm ?? 90,
    totalBars: bars.length,
    active: phase === 'playing',
    onEnd: () => {
      beatHandle.stop();
      setPhase('ended');
    },
  });

  useEffect(() => {
    if (phase !== 'loading' || !beat) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rhymes', { method: 'POST' });
        if (!res.ok) throw new Error('rhymes-failed');
        const json = await res.json();
        if (cancelled) return;
        setBars(json.bars);
        // play() returns a Promise that resolves when playback actually starts;
        // the browser will buffer first if needed. If the file fails to load
        // or autoplay is blocked, the promise rejects and we go back to Setup.
        try {
          await beatHandle.play();
        } catch {
          throw new Error('audio-failed');
        }
        if (cancelled) return;
        setPhase('playing');
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error && err.message === 'audio-failed'
              ? 'Не вдалося відтворити біт'
              : 'Не вдалося завантажити рими'
          );
          setPhase('setup');
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function handlePlay(id: string) {
    setBeatId(id);
    setLoadError(null);
    setPhase('loading');
  }

  function quitToSetup() {
    beatHandle.stop();
    setPhase('setup');
  }

  if (phase === 'setup') {
    return (
      <>
        {loadError && (
          <div className="bg-rhyme-red/30 text-center py-2">{loadError}</div>
        )}
        <Setup initialBeatId={beatId} onPlay={handlePlay} onLogout={logout} />
      </>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl">
        Завантаження...
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <EndScreen
        onPlayAgain={() => setPhase('loading')}
        onChangeBeat={() => setPhase('setup')}
      />
    );
  }

  // playing
  return (
    <main className="min-h-screen p-4 flex flex-col">
      <div className="flex justify-between mb-2">
        <button onClick={() => {
          if (confirm('Завершити сесію?')) quitToSetup();
        }} aria-label="Вийти" className="text-white/70 text-xl">←</button>
        <div className="text-white/60 text-sm">
          {beat?.title} · {beat?.bpm.toFixed(1)} BPM
        </div>
      </div>
      <BouncingBall x={tick.ballX} yDip={tick.ballYDip} />
      <div className="mt-4 mx-auto w-full max-w-md">
        <WordGrid bars={bars} activeRow={tick.currentBar} ballX={tick.ballX} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Game.tsx
git commit -m "feat(game): state machine wires Setup/Playing/End"
```

---

## Task 20: Wire up the home page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the stub with the real game**

Replace `app/page.tsx` with:

```tsx
import { Game } from '@/components/Game';

export default function Page() {
  return <Game />;
}
```

- [ ] **Step 2: Manual smoke test the full flow**

Make sure `.env.local` has `APP_PASSWORD`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`. Drop at least one `.mp3` into `public/beats/` and add an entry to `BEATS` (or temporarily hardcode an entry pointing at any test mp3).

Run: `npm run dev`
1. Visit http://localhost:3000 — redirected to /login
2. Enter password — land on Setup
3. Click ГРАТИ — see "Завантаження..." briefly, then the grid + ball with the beat playing
4. Wait through ~30 bars or hit ← to bail; either way reach a defined state
5. On End screen, "Грати знову" replays; "Інший біт" returns to Setup
6. "Вийти" from Setup → back to /login

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(game): wire Game component into home page"
```

---

## Task 21: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

Create `README.md`:

````markdown
# Римова Гра

Українська веб-версія The Rhyme Game (Classic mode). Біт грає, м'ячик стрибає по сітці, у кожному рядку справа — слово, на яке має закінчитись твій бар.

## Local dev

```bash
npm install
cp .env.example .env.local
# fill in APP_PASSWORD, AUTH_SECRET (openssl rand -hex 32), ANTHROPIC_API_KEY
npm run dev
```

Drop 8–10 royalty-free beat .mp3 files into `public/beats/` and populate `lib/beats.ts` with their metadata. The `bpm` field must be derived from each file's actual duration:

```
bpm = barsPerLoop * 4 * 60 / audioDurationSeconds
```

## Deploy (Vercel)

1. Push to GitHub.
2. Import the repo in Vercel.
3. Set env vars: `APP_PASSWORD`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`.
4. Deploy.

## Tests

```bash
npm test
```

## Architecture

See `docs/superpowers/specs/2026-05-06-rhyme-game-design.md`.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with setup + deploy instructions"
```

---

## Final verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all tests pass (auth, flatten-bars, rhymes, session-time).

- [ ] **Step 2: Build production bundle**

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 3: Smoke-test the production bundle**

Run: `npm start`
Repeat the manual flow from Task 20 Step 2.

- [ ] **Step 4: Confirm spec acceptance criteria met**

- [x] Auth-gated by shared password
- [x] /api/rhymes calls Claude (when key set) and falls back when it doesn't
- [x] Bouncing ball in sync with audio across loop wraparound
- [x] Color-grouped rhyme words
- [x] End → Play Again / Change Beat
- [x] Mid-session ← back-button with confirm
- [x] No voice / no recording / no scoring (out of scope)
