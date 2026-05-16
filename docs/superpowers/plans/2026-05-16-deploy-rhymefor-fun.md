# Deploy The Rhyme Game to rhymefor.fun — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take The Rhyme Game from local dev to live HTTPS at `https://rhymefor.fun`, hosted on the existing Ubuntu 24.04 VPS at `213.199.45.75`, with working Google + Resend magic-link sign-in and Postgres-backed waitlist.

**Architecture:** Plain Node + Postgres + Caddy on the VPS, all `systemd`-managed. Caddy terminates TLS and reverse-proxies to Next.js on `127.0.0.1:3000`. Postgres runs on `127.0.0.1:5432`. UFW allows only ports 22/80/443.

**Tech Stack:** Ubuntu 24.04, Node 22 (pre-installed), Postgres 16 (apt), Caddy 2 (apt, official repo), systemd, Next.js 14, NextAuth v5 (Google + Resend providers), `@auth/pg-adapter`.

**Spec:** [docs/superpowers/specs/2026-05-16-deploy-rhymefor-fun.md](../specs/2026-05-16-deploy-rhymefor-fun.md)

---

## Operator preconditions (verify once before starting)

- [ ] **Confirm SSH access:** `ssh vladadmin@213.199.45.75 id` returns `uid=1000(vladadmin)…` without prompting for a password.
- [ ] **Capture sudo password:** the operator (you) types the sudo password for `vladadmin` once. Store it locally at `~/.config/rhyme-deploy/sudo-pass` with `chmod 600`. This file is deleted in the final task. All `sudo` invocations over SSH use `sudo -S` with `cat ~/.config/rhyme-deploy/sudo-pass | ssh …` piping.
  ```bash
  mkdir -p ~/.config/rhyme-deploy
  read -rs SUDO_PASS && printf '%s' "$SUDO_PASS" > ~/.config/rhyme-deploy/sudo-pass && chmod 600 ~/.config/rhyme-deploy/sudo-pass && unset SUDO_PASS
  ```
- [ ] **Confirm git working tree is clean** on `master`:
  ```bash
  cd /home/asevlad/program_files/github_asevlad/Rhyme_Game
  git status --porcelain
  ```
  Expected: empty output. If there are uncommitted changes, stash or commit them before starting.

---

## Task 1: Pre-deploy code fix — rename `verification_tokens` → `verification_token`

**Why:** `@auth/pg-adapter/index.js:29` queries `verification_token` (singular), but `scripts/db-schema.sql:37` creates `verification_tokens` (plural). Magic-link sign-in would fail on the first attempt. Fix and push before the server clones the repo.

**Files:**
- Modify: `scripts/db-schema.sql:37`

- [ ] **Step 1: Apply the rename**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game
sed -i 's/CREATE TABLE verification_tokens/CREATE TABLE verification_token/' scripts/db-schema.sql
```

- [ ] **Step 2: Verify the change**

```bash
grep -n "verification_token" scripts/db-schema.sql
```

Expected output (exactly one line):
```
37:CREATE TABLE verification_token (
```

- [ ] **Step 3: Commit and push**

```bash
git add scripts/db-schema.sql
git commit -m "fix(db): rename verification_tokens to verification_token

@auth/pg-adapter queries the singular table name (verification_token),
but the schema file was creating the plural form. Magic-link sign-in
would fail on the first attempt before this fix."
git push origin master
```

Expected: push succeeds, no merge conflict.

---

## Task 2: Provision server — user, firewall, packages

**Why:** Establish the unprivileged `deploy` user, lock down the firewall, install the three system packages (Postgres, Caddy, git). All steps run via SSH as `vladadmin`. Sudo is fed via `sudo -S`.

**Files (on server):**
- Create: `/home/deploy/` (home dir, via `useradd -m`)
- Create: `/home/deploy/.ssh/authorized_keys`

- [ ] **Step 1: Discover operator's public key**

Locally:
```bash
ls ~/.ssh/*.pub
cat ~/.ssh/id_ed25519.pub 2>/dev/null || cat ~/.ssh/id_rsa.pub
```

Pick the key that's already authorized on the server (the one currently letting you `ssh vladadmin@…` without a password). Record its full content for use in Step 3.

- [ ] **Step 2: Create the `deploy` user**

```bash
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  "sudo -S useradd -m -s /bin/bash -G sudo deploy 2>&1"
```

Expected: no output (success), or `user 'deploy' already exists` (idempotent — fine).

- [ ] **Step 3: Install operator's SSH key for `deploy`**

Replace `<PUBKEY>` with the full content from Step 1:
```bash
PUBKEY="<paste pubkey here>"
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  "sudo -S bash -c 'mkdir -p /home/deploy/.ssh && echo \"$PUBKEY\" > /home/deploy/.ssh/authorized_keys && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys && chown -R deploy:deploy /home/deploy/.ssh' 2>&1"
```

- [ ] **Step 4: Verify `deploy` SSH works**

```bash
ssh deploy@213.199.45.75 'whoami && pwd'
```

Expected:
```
deploy
/home/deploy
```

- [ ] **Step 5: Configure UFW firewall**

```bash
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  "sudo -S bash -c 'ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable && ufw status verbose' 2>&1"
```

Expected output contains:
```
Status: active
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
```

- [ ] **Step 6: Install Caddy's apt repository signing key**

```bash
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  "sudo -S bash -c 'apt install -y debian-keyring debian-archive-keyring apt-transport-https curl && curl -1sLf \"https://dl.cloudsmith.io/public/caddy/stable/gpg.key\" | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && curl -1sLf \"https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt\" > /etc/apt/sources.list.d/caddy-stable.list' 2>&1"
```

Expected: keyring file created, no errors. (Some output from `apt install -y` for the prerequisites is normal.)

- [ ] **Step 7: Install Postgres 16, Caddy, git, build-essential**

```bash
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  "sudo -S bash -c 'apt update && apt install -y postgresql-16 caddy git build-essential ca-certificates' 2>&1" | tail -20
```

Expected last lines include:
```
Setting up caddy (...) ...
Setting up postgresql-16 (...) ...
```

- [ ] **Step 8: Verify all three services are running**

```bash
ssh vladadmin@213.199.45.75 'systemctl is-active postgresql caddy && which git'
```

Expected:
```
active
active
/usr/bin/git
```

---

## Task 3: Create Postgres role, database, and schema

**Why:** Apply the `scripts/db-schema.sql` shipped in the repo, after creating a least-privilege role and database. The schema fix from Task 1 must be in `master` before this task can run.

**Files (on server):**
- Read-only: `/tmp/db-schema.sql` (uploaded from local repo)

- [ ] **Step 1: Generate a strong DB password locally**

```bash
DB_PASS=$(openssl rand -hex 16)
echo "DB password: $DB_PASS"
```

Record this value — it goes into `.env` in Task 7. (Reissue the command if you lose it; just regenerate role + password.)

- [ ] **Step 2: Create role and database**

```bash
DB_PASS="<paste value from Step 1>"
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  "sudo -S -u postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE rhyme_app WITH LOGIN PASSWORD '$DB_PASS';
CREATE DATABASE rhyme_game OWNER rhyme_app;
GRANT ALL PRIVILEGES ON DATABASE rhyme_game TO rhyme_app;
SQL"
```

Expected: three lines, `CREATE ROLE`, `CREATE DATABASE`, `GRANT`. (If a `role already exists` error: `ALTER ROLE rhyme_app WITH PASSWORD '$DB_PASS';` instead.)

- [ ] **Step 3: Verify connectivity with the new role**

```bash
ssh vladadmin@213.199.45.75 \
  "PGPASSWORD='$DB_PASS' psql -h 127.0.0.1 -U rhyme_app -d rhyme_game -c 'SELECT current_user, current_database();'"
```

Expected output contains:
```
 current_user | current_database
 rhyme_app    | rhyme_game
```

- [ ] **Step 4: Upload the schema file**

```bash
scp /home/asevlad/program_files/github_asevlad/Rhyme_Game/scripts/db-schema.sql vladadmin@213.199.45.75:/tmp/db-schema.sql
```

- [ ] **Step 5: Apply the schema**

```bash
ssh vladadmin@213.199.45.75 \
  "PGPASSWORD='$DB_PASS' psql -h 127.0.0.1 -U rhyme_app -d rhyme_game -v ON_ERROR_STOP=1 -f /tmp/db-schema.sql"
```

Expected output:
```
CREATE EXTENSION
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
```

(5 tables: `users`, `accounts`, `sessions`, `verification_token`, `waitlist`.)

- [ ] **Step 6: Verify all five tables exist**

```bash
ssh vladadmin@213.199.45.75 \
  "PGPASSWORD='$DB_PASS' psql -h 127.0.0.1 -U rhyme_app -d rhyme_game -c '\dt'"
```

Expected list includes:
```
accounts | table | rhyme_app
sessions | table | rhyme_app
users | table | rhyme_app
verification_token | table | rhyme_app
waitlist | table | rhyme_app
```

- [ ] **Step 7: Clean up the schema file**

```bash
ssh vladadmin@213.199.45.75 'rm /tmp/db-schema.sql'
```

---

## Task 4: Operator action — create Google OAuth client

**Why:** Required for Google sign-in. The redirect URI must be set up in the OAuth client before sign-in will work.

**This task is fully manual — done by the operator in a browser.**

- [ ] **Step 1: Visit Google Cloud Console**

Open https://console.cloud.google.com/ — create or select a project (e.g. "Rhyme Game").

- [ ] **Step 2: Configure OAuth consent screen**

- Sidebar → APIs & Services → OAuth consent screen
- User type: **External**, click Create
- App information:
  - App name: `Rhyme for fun`
  - User support email: `kvochkinvlad@gmail.com`
  - Developer contact email: `kvochkinvlad@gmail.com`
- Save and continue through Scopes (no changes needed), Test users (optional — add `kvochkinvlad@gmail.com` as a test user), Summary.

- [ ] **Step 3: Create OAuth 2.0 Client ID**

- Sidebar → APIs & Services → Credentials → Create credentials → OAuth client ID
- Application type: **Web application**
- Name: `Rhyme Game (production)`
- **Authorized redirect URIs:** add `https://rhymefor.fun/api/auth/callback/google`
- Click Create

- [ ] **Step 4: Capture the client ID and secret**

The dialog shows **Client ID** and **Client secret**. Copy both. Store them somewhere safe — they go into `.env` in Task 7.

---

## Task 5: Operator action — Resend account + add domain

**Why:** Required for magic-link email sign-in. The DKIM/SPF records returned here are part of the DNS update in Task 6.

**This task is fully manual — done by the operator in a browser.**

- [ ] **Step 1: Sign up at resend.com**

Use `kvochkinvlad@gmail.com`. Verify the signup email.

- [ ] **Step 2: Add `rhymefor.fun` as a domain**

- Dashboard → Domains → Add Domain → enter `rhymefor.fun`
- Region: pick the one closest to your users (e.g. `eu-west-1` if Europe-focused)
- Click Add — Resend shows a list of DNS records (SPF TXT, DKIM CNAME ×3, optional MX). **Keep this tab open** — you'll copy these into the registrar in Task 6.

- [ ] **Step 3: Create an API key with sending-only scope**

- Dashboard → API Keys → Create API Key
- Name: `rhymefor.fun production`
- Permission: **Sending access** (not full access)
- Domain: select `rhymefor.fun`
- Copy the `re_...` value. This is `AUTH_RESEND_KEY` in `.env`.

---

## Task 6: Operator action — DNS at registrar

**Why:** Two purposes — point `rhymefor.fun` → `213.199.45.75` so Caddy can issue HTTPS, and add the Resend records so the magic-link sender domain verifies.

**This task is fully manual — done by the operator at the domain registrar.**

The nameservers (`inhostedns.com/net/org`) suggest NameSilo or a similar reseller. The exact UI varies; the records below are universal.

- [ ] **Step 1: Remove the existing A record**

The current `A @ → 91.206.200.120` must be removed (or replaced).

- [ ] **Step 2: Add A records pointing to the VPS**

```
A    @     213.199.45.75    TTL 300
A    www   213.199.45.75    TTL 300
```

- [ ] **Step 3: Add the Resend records from Task 5 Step 2**

There will be:
- 1 × TXT (SPF) — typically `v=spf1 include:_spf.resend.com ~all`
- 3 × CNAME (DKIM) — `resend._domainkey`, plus return-path CNAMEs
- Optional 1 × MX (return-path) — add it if Resend lists it

Use whatever TTL the registrar defaults to.

- [ ] **Step 4: Verify A records have propagated**

Locally:
```bash
dig +short rhymefor.fun A
dig +short www.rhymefor.fun A
```

Both should return `213.199.45.75`. Re-run every minute if needed; typically resolves within 5 minutes but can take up to an hour.

- [ ] **Step 5: Verify Resend domain status**

Back at resend.com → Domains → `rhymefor.fun` should show **Verified** (green). May take 5–60 min after DNS update. **This does not block app deployment** — magic-link is the only thing waiting on it.

---

## Task 7: Deploy the app on the server

**Why:** Clone the repo, install deps, build, write `.env`, and install systemd + Caddy units. The app will be reachable on `http://213.199.45.75` via Host header after this task. Can run as soon as Tasks 1, 3, 4, 5 are done — does **not** require DNS (Task 6) to complete first.

**Files (on server):**
- Create: `/home/deploy/rhyme-game/` (via git clone)
- Create: `/home/deploy/rhyme-game/.env` (mode 600)
- Create: `/etc/systemd/system/rhyme-game.service`
- Create: `/etc/caddy/Caddyfile` (replacing default)
- Create: `/etc/sudoers.d/deploy-rhyme-game`

- [ ] **Step 1: Clone the repo**

```bash
ssh deploy@213.199.45.75 \
  'git clone https://github.com/ASEVlad/Rhyme_Game.git ~/rhyme-game && cd ~/rhyme-game && git log -1 --oneline'
```

Expected: clone progresses (~30s–1min for 288MB), then prints the latest commit hash on `master`. Verify the latest commit is the `fix(db): rename verification_tokens` commit from Task 1.

- [ ] **Step 2: Install dependencies and build**

```bash
ssh deploy@213.199.45.75 'cd ~/rhyme-game && npm ci && npm run build 2>&1 | tail -10'
```

Expected last lines include:
```
✓ Compiled successfully
…
Route (app)                              Size     First Load JS
```

If the build fails, check `journalctl` later isn't an option — these errors print to stderr. Fix and retry.

- [ ] **Step 3: Run the test suite on the server**

```bash
ssh deploy@213.199.45.75 'cd ~/rhyme-game && npm test 2>&1 | tail -20'
```

Expected last lines include `Test Files  N passed` and `Tests  M passed`. If anything fails, stop and investigate.

- [ ] **Step 4: Build the `.env` locally**

Collect all values:

| Key | Source |
|---|---|
| `AUTH_SECRET` | from local `/home/asevlad/.../Rhyme_Game/.env` |
| `AUTH_URL` | `https://rhymefor.fun` |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_GOOGLE_ID` | from Task 4 Step 4 |
| `AUTH_GOOGLE_SECRET` | from Task 4 Step 4 |
| `AUTH_RESEND_KEY` | from Task 5 Step 3 |
| `EMAIL_FROM` | `noreply@rhymefor.fun` |
| `POSTGRES_URL` | `postgres://rhyme_app:<DB_PASS>@localhost:5432/rhyme_game` (from Task 3 Step 1) |
| `ANTHROPIC_API_KEY` | from local `.env` |
| `ALLOWED_EMAILS` | `kvochkinvlad@gmail.com` |
| `WAITLIST_NOTIFY_EMAIL` | from local `.env` |
| `HOSTNAME` | `127.0.0.1` |
| `NODE_ENV` | `production` |

Build a temp file:
```bash
TMP_ENV=$(mktemp)
cat > "$TMP_ENV" <<'EOF'
AUTH_SECRET=<paste>
AUTH_URL=https://rhymefor.fun
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=<paste>
AUTH_GOOGLE_SECRET=<paste>
AUTH_RESEND_KEY=<paste>
EMAIL_FROM=noreply@rhymefor.fun
POSTGRES_URL=postgres://rhyme_app:<DB_PASS>@localhost:5432/rhyme_game
ANTHROPIC_API_KEY=<paste>
ALLOWED_EMAILS=kvochkinvlad@gmail.com
WAITLIST_NOTIFY_EMAIL=<paste>
HOSTNAME=127.0.0.1
NODE_ENV=production
EOF
chmod 600 "$TMP_ENV"
echo "Built env at $TMP_ENV"
```

- [ ] **Step 5: Upload `.env` to the server**

```bash
scp "$TMP_ENV" deploy@213.199.45.75:/home/deploy/rhyme-game/.env
ssh deploy@213.199.45.75 'chmod 600 ~/rhyme-game/.env && ls -l ~/rhyme-game/.env'
rm "$TMP_ENV"
```

Expected: server-side `ls -l` shows `-rw------- 1 deploy deploy ... .env`.

- [ ] **Step 6: Install systemd unit**

Create the unit file via SSH heredoc (sudo'd):
```bash
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  "sudo -S tee /etc/systemd/system/rhyme-game.service > /dev/null" <<'UNIT'
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
UNIT
```

- [ ] **Step 7: Enable and start the service**

```bash
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  'sudo -S bash -c "systemctl daemon-reload && systemctl enable --now rhyme-game"'
```

Expected: `Created symlink …rhyme-game.service` (or silent on subsequent runs).

- [ ] **Step 8: Verify the app is running**

```bash
ssh vladadmin@213.199.45.75 'systemctl is-active rhyme-game && curl -sI http://127.0.0.1:3000/ | head -5'
```

Expected:
```
active
HTTP/1.1 200 OK
…
```

If `is-active` returns `failed`, inspect `journalctl -u rhyme-game -n 50`.

- [ ] **Step 9: Install Caddyfile**

```bash
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  "sudo -S tee /etc/caddy/Caddyfile > /dev/null" <<'CADDY'
rhymefor.fun, www.rhymefor.fun {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
CADDY
```

- [ ] **Step 10: Reload Caddy**

```bash
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  'sudo -S systemctl reload caddy && sudo -S systemctl status caddy --no-pager | head -10'
```

Expected: `Active: active (running)` in the status output. Caddy won't issue a cert yet (DNS not pointed) but should be running and serving on :80 / :443.

- [ ] **Step 11: Add sudoers rule for `deploy` to restart the service**

This allows the update script (Task 9) to restart without operator sudo.
```bash
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  "sudo -S tee /etc/sudoers.d/deploy-rhyme-game > /dev/null" <<'SUDOERS'
deploy ALL=(root) NOPASSWD: /bin/systemctl restart rhyme-game
SUDOERS
cat ~/.config/rhyme-deploy/sudo-pass | ssh vladadmin@213.199.45.75 \
  'sudo -S bash -c "chmod 440 /etc/sudoers.d/deploy-rhyme-game && visudo -c"'
```

Expected: `parsed OK` from `visudo -c`. If parse fails, immediately remove the file: `sudo rm /etc/sudoers.d/deploy-rhyme-game`.

- [ ] **Step 12: Sanity-check the deploy user can restart the service**

```bash
ssh deploy@213.199.45.75 'sudo systemctl restart rhyme-game && sleep 2 && systemctl is-active rhyme-game'
```

Expected:
```
active
```

---

## Task 8: Pre-DNS verification — reach the app via Host header

**Why:** Confirm the full stack (Caddy → Next.js → Postgres → external APIs) works **before** flipping DNS. This makes the DNS step low-risk: if Phase 7 worked, Phase 8 will work, the only difference is the URL.

- [ ] **Step 1: Hit the app through Caddy with a faked Host header**

```bash
curl -sI -H 'Host: rhymefor.fun' http://213.199.45.75/
```

Expected: `HTTP/1.1 200 OK` (or `308 Permanent Redirect` if Caddy is forcing HTTPS — we'll relax that next step if so).

If you get `308`, fetch the home page over HTTPS with `--insecure` (cert won't match yet):
```bash
curl -skI -H 'Host: rhymefor.fun' --resolve rhymefor.fun:443:213.199.45.75 https://rhymefor.fun/
```

Same expected `200`.

- [ ] **Step 2: Confirm the home page renders**

```bash
curl -s -H 'Host: rhymefor.fun' --resolve rhymefor.fun:443:213.199.45.75 -k https://rhymefor.fun/ | grep -i "<title>"
```

Expected: a `<title>` tag with the app's name (e.g. `Rhyme Game` or whatever the current title is).

- [ ] **Step 3: Smoke-test the waitlist API end-to-end**

```bash
curl -s -X POST -H 'Content-Type: application/json' -H 'Host: rhymefor.fun' \
  --resolve rhymefor.fun:443:213.199.45.75 -k \
  -d '{"email":"deploy-smoketest@example.com"}' \
  https://rhymefor.fun/api/waitlist
```

Expected: `{"ok":true}`.

Confirm the row landed in the DB:
```bash
ssh vladadmin@213.199.45.75 \
  "PGPASSWORD='$DB_PASS' psql -h 127.0.0.1 -U rhyme_app -d rhyme_game -c \"SELECT email, created_at FROM waitlist WHERE email = 'deploy-smoketest@example.com';\""
```

Expected: one row showing the smoke-test email.

- [ ] **Step 4: Clean up the smoke-test row**

```bash
ssh vladadmin@213.199.45.75 \
  "PGPASSWORD='$DB_PASS' psql -h 127.0.0.1 -U rhyme_app -d rhyme_game -c \"DELETE FROM waitlist WHERE email = 'deploy-smoketest@example.com';\""
```

Expected: `DELETE 1`.

---

## Task 9: Go live — DNS verification, cert issuance, sign-in smoke test

**Why:** With DNS pointing to the box (Task 6) and the app verified locally (Task 8), all that remains is Caddy fetching its cert and a real sign-in round-trip.

- [ ] **Step 1: Verify DNS has propagated**

```bash
dig +short rhymefor.fun A
dig +short www.rhymefor.fun A
```

Both must return `213.199.45.75`. If they still show `91.206.200.120`, return to Task 6 and wait longer.

- [ ] **Step 2: Trigger Caddy to issue the certificate**

A simple HTTPS request triggers ACME. Watch Caddy logs in one terminal:
```bash
ssh vladadmin@213.199.45.75 'sudo journalctl -u caddy -f --since "5 min ago"'
```

In another terminal:
```bash
curl -sI https://rhymefor.fun/
```

Expected in the journalctl stream: lines containing `obtained certificate` and the domain name. Expected curl output: `HTTP/2 200`.

(Ctrl-C the journalctl stream once you see the certificate-obtained line.)

- [ ] **Step 3: Browser smoke test — landing page**

Open `https://rhymefor.fun/` in a browser. Expected:
- Page loads with a valid TLS lock icon
- The landing page renders as it does in local dev
- `http://rhymefor.fun/` redirects to HTTPS

- [ ] **Step 4: Smoke-test Google sign-in**

- Click "Continue with Google" on `/login`
- Sign in as `kvochkinvlad@gmail.com`
- Expected: redirected to `/play` (sign-in successful)
- Sign out

- [ ] **Step 5: Smoke-test magic-link sign-in**

If Resend domain isn't yet **Verified** in their dashboard (Task 5 Step 2), skip this step until it is. Once verified:
- On `/login`, enter `kvochkinvlad@gmail.com` and click "Send sign-in link"
- Expected: form replaced with "Check your inbox — we sent a sign-in link to …"
- Check inbox (may be ~30s); click the link
- Expected: redirected to `/play` signed in
- Sign out

- [ ] **Step 6: Smoke-test waitlist (real submission)**

- Navigate to the landing page (signed out)
- Submit a fresh email (something you control but distinct from your allowlisted one — e.g. an alias)
- Expected: form shows success state
- Check that the operator's `WAITLIST_NOTIFY_EMAIL` inbox receives the notification email (may be 30–60s)
- Delete the smoke-test row from DB (same SQL as Task 8 Step 4 with the new email)

- [ ] **Step 7: Smoke-test sign-in rejection for non-allowlisted email**

- On `/login`, attempt magic-link with `someone-not-in-allowlist@example.com`
- Expected: the form still shows "Check your inbox" (privacy — no oracle)
- The email may not arrive depending on Resend deliverability to random addresses — that's fine
- If you have a second real address: sign in with it; expected redirect to `/login?error=AccessDenied` after clicking the link

---

## Task 10: Add `scripts/deploy.sh` for future updates

**Why:** Codify the update workflow. After this task, redeploys are a single command.

**Files:**
- Create: `scripts/deploy.sh` (mode 755)

- [ ] **Step 1: Create the script**

```bash
cat > /home/asevlad/program_files/github_asevlad/Rhyme_Game/scripts/deploy.sh <<'SCRIPT'
#!/usr/bin/env bash
# Update rhymefor.fun production. Runs on the operator's laptop.
# Pulls master, rebuilds, restarts the service.
set -euo pipefail

REMOTE="deploy@213.199.45.75"

ssh "$REMOTE" '
  set -euo pipefail
  cd ~/rhyme-game
  echo "==> git pull"
  git pull --ff-only
  echo "==> npm ci"
  npm ci
  echo "==> npm run build"
  npm run build
  echo "==> restart service"
  sudo systemctl restart rhyme-game
  echo "==> wait for health"
  for i in $(seq 1 10); do
    if curl -sf http://127.0.0.1:3000/ > /dev/null; then
      echo "OK"
      exit 0
    fi
    sleep 1
  done
  echo "FAILED: app did not come up healthy"
  journalctl -u rhyme-game -n 30 --no-pager
  exit 1
'
SCRIPT
chmod 755 /home/asevlad/program_files/github_asevlad/Rhyme_Game/scripts/deploy.sh
```

- [ ] **Step 2: Commit the deploy script**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game
git add scripts/deploy.sh
git commit -m "chore(deploy): add scripts/deploy.sh

One-command production update: ssh, pull, rebuild, restart, health-check."
git push origin master
```

- [ ] **Step 3: Test the deploy script end-to-end**

Run the script locally:
```bash
./scripts/deploy.sh
```

Expected output ends with `==> wait for health\nOK`.

The very first run also pulls the deploy.sh commit itself onto the server — second run from this point forward is the steady state.

---

## Task 11: Cleanup

- [ ] **Step 1: Remove the local sudo password file**

```bash
shred -u ~/.config/rhyme-deploy/sudo-pass
rmdir ~/.config/rhyme-deploy 2>/dev/null || true
```

- [ ] **Step 2: Confirm DB_PASS is recorded somewhere safe**

If you saved it in a password manager, fine. If not — it lives in `/home/deploy/rhyme-game/.env` on the server and that's the only copy. Losing it means rotating the role:
```bash
# emergency recovery only
sudo -u postgres psql -c "ALTER ROLE rhyme_app WITH PASSWORD '<new-pass>';"
# update /home/deploy/rhyme-game/.env, then systemctl restart rhyme-game
```

- [ ] **Step 3: Optional — tighten Caddy with `www → root` redirect**

If you prefer a canonical URL (`https://rhymefor.fun` instead of either www or root), replace the Caddyfile:
```caddy
rhymefor.fun {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}

www.rhymefor.fun {
    redir https://rhymefor.fun{uri} permanent
}
```
Then `sudo systemctl reload caddy`. Skip if you want both URLs to serve.

- [ ] **Step 4: Document the deploy in the repo**

Optional: add a one-paragraph "Production" section to `README.md` pointing future contributors at `scripts/deploy.sh` and the spec/plan in `docs/superpowers/`.

---

## Done

Live at `https://rhymefor.fun`. Update workflow: `./scripts/deploy.sh` from the operator's laptop. Adding more allowlisted emails: edit `/home/deploy/rhyme-game/.env` on the server, then `sudo systemctl restart rhyme-game`. Logs: `journalctl -u rhyme-game -f` on the server.
