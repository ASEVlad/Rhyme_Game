# Deploy The Rhyme Game to `rhymefor.fun`

**Date:** 2026-05-16
**Status:** Proposed

## Goal

Move The Rhyme Game from local development to a public, HTTPS-served deployment at `https://rhymefor.fun`, hosted on the VPS at `213.199.45.75` (user `vladadmin`, Ubuntu 24.04 LTS). The app must support Google sign-in, Resend magic-link sign-in, and the existing Postgres-backed waitlist API.

## Motivation

The app is feature-complete enough for a closed-beta launch. Today it only runs on the developer's laptop. To invite the first round of testers, the app needs a stable public URL, persistent storage, real OAuth, and working magic-link email.

## Non-goals

- CI/CD automation. Deploys remain a manual `git pull && npm ci && npm run build && systemctl restart` invocation, wrapped in a one-liner script.
- Zero-downtime deploys / blue-green. A `systemctl restart` is acceptable (sub-second downtime).
- Multi-region or staging environment. One server, one environment.
- Containerization. The app runs as a plain Node process under systemd.
- Database backups beyond what `pg_dump` from a cron makes possible later (out of scope for this deploy).
- Monitoring / observability stack beyond `journalctl`.

## Architecture

```
Internet ──(:80, :443)──▶ Caddy ──(127.0.0.1:3000)──▶ Next.js (npm start)
                            │                            │
                  auto Let's Encrypt                     ├──▶ Postgres (127.0.0.1:5432)
                  for rhymefor.fun,                      ├──▶ Anthropic API
                  www.rhymefor.fun                       └──▶ Resend API
```

Three long-running services on the VPS, all `systemd`-managed:

| Service | What it runs | Port |
|---|---|---|
| `postgresql.service` | Postgres 16 (apt-installed) | 127.0.0.1:5432 |
| `rhyme-game.service` | `npm start` as user `deploy`, in `/home/deploy/rhyme-game` | 127.0.0.1:3000 |
| `caddy.service` | Caddy 2 (apt-installed), reverse proxy + ACME | 0.0.0.0:80, 0.0.0.0:443 |

UFW firewall allows only ports 22, 80, 443.

## Server provisioning (Phase 1)

Run once. All as root via SSH.

1. **Unprivileged user.** Create `deploy` user, add to `sudo` group, copy the operator's SSH pubkey to `/home/deploy/.ssh/authorized_keys`.
2. **Firewall.** `ufw allow 22,80,443/tcp; ufw enable`.
3. **Packages.** `apt update && apt install -y postgresql-16 caddy git build-essential ca-certificates`.
   - `build-essential` is needed because `pg` includes a native fallback that may be compiled by `npm install`.
   - Caddy is installed from the official Cloudsmith repo per [Caddy's Ubuntu install guide](https://caddyserver.com/docs/install#debian-ubuntu-raspbian).
4. **Database.** As the `postgres` system user:
   - `CREATE ROLE rhyme_app WITH LOGIN PASSWORD '<generated-32-char>';`
   - `CREATE DATABASE rhyme_game OWNER rhyme_app;`
   - `GRANT ALL PRIVILEGES ON DATABASE rhyme_game TO rhyme_app;`
   The generated password is recorded once into the app's `.env` and nowhere else.
5. **Adapter schema.** Run the SQL DDL from [`@auth/pg-adapter`'s README](https://authjs.dev/reference/adapter/pg) against `rhyme_game` (creates `users`, `accounts`, `sessions`, `verification_token`). Also create the `waitlist` table the existing `/api/waitlist` route expects (see "Schema" below).

### Schema

Two schemas live in the same database:

- **NextAuth tables** (`users`, `accounts`, `sessions`, `verification_token`) — managed by `@auth/pg-adapter`. DDL copied verbatim from the adapter's docs.
- **Waitlist table** — used by `app/api/waitlist/route.ts`. The exact column shape is read from the source file at provisioning time and translated into `CREATE TABLE` DDL. (No migration tooling exists in the repo; the table is created once by hand.)

## External account setup (Phase 2, in parallel with Phase 1)

The operator does these by hand, following click-by-click checklists provided during execution.

1. **Google OAuth client.**
   - Google Cloud Console → APIs & Services → OAuth consent screen → External, fill required fields (app name `Rhyme for fun`, support email, dev contact email).
   - Credentials → Create credentials → OAuth client ID → Web application.
   - **Authorized redirect URIs:** `https://rhymefor.fun/api/auth/callback/google`.
   - Copy the Client ID and Client Secret. These become `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
2. **Resend account.**
   - Sign up at resend.com.
   - Domains → Add `rhymefor.fun`.
   - Resend produces a set of DNS records (SPF, DKIM, optional MX/return-path) — copy these.
   - API Keys → create a key with **Sending access only**. Copy the `re_...` value. This becomes `AUTH_RESEND_KEY`.
3. **DNS at the registrar** (nameservers are `inhostedns.*` — likely NameSilo / Namecheap):
   - `A    @     213.199.45.75`  (TTL 300)
   - `A    www   213.199.45.75`  (TTL 300)
   - SPF + DKIM records from Resend (TTL their default)
   - The existing A record pointing at `91.206.200.120` is removed.

DNS propagation is typically minutes for new records but can be longer. Caddy's first cert issuance and Resend's domain verification both poll DNS — they self-heal once propagation completes.

## App deploy (Phase 3)

As user `deploy`:

1. `git clone https://github.com/ASEVlad/Rhyme_Game.git /home/deploy/rhyme-game` (public repo; HTTPS clone, no key setup needed). Checkout `master`.
2. `cd rhyme-game && npm ci`. Then `npm run build`.
3. Build `.env` on the operator's laptop (combining values carried over from local `.env` with the new ones obtained in Phase 2), `scp` it to `/tmp/rhyme-game.env` on the server, then as `deploy` move it to `/home/deploy/rhyme-game/.env` and `chmod 600`.
4. `npm test` to confirm vitest passes on the server.
5. As root, install systemd unit at `/etc/systemd/system/rhyme-game.service`:

   ```ini
   [Unit]
   Description=Rhyme Game Next.js app
   After=network.target postgresql.service
   Requires=postgresql.service

   [Service]
   Type=simple
   User=deploy
   Group=deploy
   WorkingDirectory=/home/deploy/rhyme-game
   EnvironmentFile=/home/deploy/rhyme-game/.env
   ExecStart=/usr/bin/npm start
   Restart=on-failure
   RestartSec=5
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```

   `systemctl daemon-reload && systemctl enable --now rhyme-game`.

6. Install `/etc/caddy/Caddyfile`:

   ```caddy
   rhymefor.fun, www.rhymefor.fun {
       encode zstd gzip
       reverse_proxy 127.0.0.1:3000
   }
   ```

   `systemctl reload caddy`.

7. **Verify before DNS flip:** from a laptop, `curl -H 'Host: rhymefor.fun' http://213.199.45.75/` returns the home page. App logs visible via `journalctl -u rhyme-game -f`.

## Go-live (Phase 4)

1. Confirm `dig +short rhymefor.fun A` returns `213.199.45.75` (and same for `www`).
2. Caddy's first request triggers ACME — `journalctl -u caddy -f` shows certificate obtained.
3. Visit `https://rhymefor.fun` from a browser: home page loads, `http://` redirects to `https://`.
4. Sign-in smoke test:
   - Google sign-in with `kvochkinvlad@gmail.com` → redirects to `/play`.
   - Magic-link sign-in with the same email → email arrives → clicking the link signs in.
5. Waitlist smoke test: submit a fresh email at the landing page, confirm row appears in the `waitlist` table and the notification email arrives at `WAITLIST_NOTIFY_EMAIL`.

## Update workflow (post-deploy)

`scripts/deploy.sh`, committed to the repo:

```bash
#!/usr/bin/env bash
set -euo pipefail
ssh deploy@213.199.45.75 '
  cd ~/rhyme-game &&
  git pull --ff-only &&
  npm ci &&
  npm run build &&
  sudo systemctl restart rhyme-game
'
```

The `sudo systemctl restart rhyme-game` requires a sudoers rule for the `deploy` user limited to that one command — added during provisioning at `/etc/sudoers.d/deploy-rhyme-game`.

## Environment variables

`/home/deploy/rhyme-game/.env`, mode `600`:

| Key | Source | Notes |
|---|---|---|
| `AUTH_SECRET` | Carried over from local `.env` | 64-char hex. |
| `AUTH_URL` | New value: `https://rhymefor.fun` | NextAuth v5 production origin. |
| `AUTH_TRUST_HOST` | New value: `true` | Required when behind a reverse proxy (Caddy). |
| `AUTH_GOOGLE_ID` | New, from Google Cloud Console | Obtained in Phase 2. |
| `AUTH_GOOGLE_SECRET` | New, from Google Cloud Console | Obtained in Phase 2. |
| `AUTH_RESEND_KEY` | New, from Resend dashboard | `re_...` |
| `EMAIL_FROM` | New: `noreply@rhymefor.fun` | Must be on a verified Resend domain. |
| `POSTGRES_URL` | Generated during Phase 1 | `postgres://rhyme_app:<pwd>@localhost:5432/rhyme_game` |
| `ANTHROPIC_API_KEY` | Carried over from local `.env` | 108 chars. |
| `ALLOWED_EMAILS` | New: `kvochkinvlad@gmail.com` | Single-entry allowlist for first deploy. |
| `WAITLIST_NOTIFY_EMAIL` | Carried over from local `.env` | Notification target for new waitlist signups. |
| `INVITE_CODE` | Unset (empty) | `/login` is publicly visible per design decision. |
| `NODE_ENV` | `production` | Set automatically by `npm start` for Next.js. |

The vestigial `APP_PASSWORD` from the local `.env` is **not** carried over — it's unreferenced anywhere in the code.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| DNS propagation slower than expected | Phase 3 verifies the app works over plain HTTP via Host-header curl, so the deploy is provably complete before DNS flips. Caddy retries ACME automatically. |
| Postgres role password leaks | Generated locally with `openssl rand -hex 16`, stored only in the `.env` (mode 600). No other copies. |
| Resend domain verification stalls | Magic-link sign-in is non-blocking — Google sign-in still works. Operator can complete Resend verification later without redeploying. |
| `npm ci` fails on server due to native deps | `build-essential` is installed during provisioning. If `pg` still fails, fall back to `npm install --build-from-source pg`. |
| Server reboots and app doesn't come back | `systemctl enable` makes the service start at boot. Same for postgresql and caddy (default on apt install). |
| Operator pushes a broken build | `systemctl restart` fails fast; `journalctl -u rhyme-game` shows the error; the previous build remains on disk until the next `npm run build` finishes. |

## Testing plan

Server-side:

- `npm test` (vitest) passes on the server before enabling the systemd unit.
- `systemctl status rhyme-game` shows `active (running)`.
- `curl http://127.0.0.1:3000/` from the server returns HTML.
- `psql -U rhyme_app -d rhyme_game -c '\dt'` lists `users`, `accounts`, `sessions`, `verification_token`, `waitlist`.

External (after DNS + cert):

- `https://rhymefor.fun/` loads landing page; redirects from `http://` work.
- Google sign-in round-trips successfully for `kvochkinvlad@gmail.com`.
- Magic-link email arrives within ~30s; clicking link signs the user in.
- Sign-in attempt with a non-allowlisted email shows the existing `AccessDenied` error.
- Waitlist submission persists to DB and triggers a notification email.

## Out of scope (deferred)

- Database backups (manual `pg_dump` cron). To be addressed in a follow-up.
- Log retention beyond systemd-journald defaults.
- Rate limiting on `/api/waitlist` or sign-in endpoints.
- Multi-operator access (only `vladadmin` and `deploy` users exist on the box).
- Adding more emails to `ALLOWED_EMAILS` — done by editing `.env` + `systemctl restart` later.
