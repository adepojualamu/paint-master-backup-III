# Run Paint Masters on your laptop

A complete walkthrough — install Node, get the backend running, point the frontend at it, and verify with a smoke test. About **15 minutes** end-to-end on a fresh machine.

The instructions cover **Windows** and **Mac**. Linux users: the Mac instructions work for you with `apt`/`yum` instead of Homebrew.

---

## What you'll have when you're done

- A real database on your machine (SQLite file at `backend/data/paintgh.db`)
- The API running at `http://localhost:3000`
- The customer site at `http://localhost:3000/`
- The admin console at `http://localhost:3000/admin/`
- All bookings, quotes, payments persisting to disk

This is the same code that will deploy to a server later. Running it locally first is the fastest way to bypass the npm restriction in the cloud sandbox and confirm everything works end-to-end.

---

## Step 1 — Install Node.js (one-time)

You need **Node.js 20 or later**. If you've already got it, run `node --version` to confirm; if it says v20 or higher, skip to Step 2.

### Windows

1. Go to <https://nodejs.org/en/download>
2. Download the **Windows Installer (.msi)** under the **LTS** tab — pick `Windows Installer (.msi) 64-bit`
3. Run the installer. Default options are fine. Make sure "Add to PATH" stays ticked.
4. Open a **new** PowerShell or Command Prompt window (the old ones won't see the new PATH)
5. Verify:
   ```powershell
   node --version
   npm --version
   ```
   Both should print version numbers.

### Mac

The cleanest path is via Homebrew. If you don't have Homebrew, install it first:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then:

```bash
brew install node
```

Verify:

```bash
node --version
npm --version
```

Alternative (no Homebrew): download the `.pkg` installer from <https://nodejs.org/en/download>.

---

## Step 2 — Get the project onto your laptop

You should have the project folder on your machine already (the same folder Claude has been editing). If not, copy the entire `paint-masters` folder from wherever you're keeping it to a known location like `~/Projects/paint-masters` (Mac) or `C:\Projects\paint-masters` (Windows).

Open a terminal and `cd` into the **backend** folder:

### Windows (PowerShell)
```powershell
cd C:\Projects\paint-masters\backend
```

### Mac (Terminal)
```bash
cd ~/Projects/paint-masters/backend
```

---

## Step 3 — Install dependencies

This is the step that fails in the cloud sandbox. On your laptop with internet access, it works.

```bash
npm install
```

Expect ~30 seconds while npm downloads `express`, `better-sqlite3`, `bcryptjs`, `jsonwebtoken`, and friends. You'll see a `node_modules/` folder appear.

If you see warnings about deprecated packages, ignore them — they're informational, not errors. The only thing that matters is the final exit code (no `error` printed at the end).

### Windows-specific gotcha

`better-sqlite3` is a **native module** that compiles C++ during install. If you see an error mentioning `node-gyp` or `MSBuild`:

1. Open PowerShell **as Administrator** and run:
   ```powershell
   npm install --global --production windows-build-tools
   ```
   That installs Python + Visual Studio Build Tools (~2 GB, takes 5-10 min).
2. Then re-run `npm install` in the backend folder.

Alternatively, install **Visual Studio 2022 Community** with the "Desktop development with C++" workload — it includes everything `node-gyp` needs.

### Mac-specific gotcha

If `better-sqlite3` errors during install, you probably need Apple's command-line developer tools:

```bash
xcode-select --install
```

A dialog pops up — click "Install" and wait ~5 minutes. Then re-run `npm install`.

---

## Step 4 — Set up the environment file

The backend reads secrets and configuration from `backend/.env`. A starter `.env` may already be in the folder; if not, create one:

### Windows (PowerShell)
```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
```

### Mac
```bash
cp .env.example .env 2>/dev/null || true
```

Then open `.env` in any editor (VS Code, Notepad, TextEdit) and confirm at minimum these lines exist:

```ini
NODE_ENV=development
PORT=3000
JWT_SECRET=change-this-to-something-random-48-chars-or-more
DB_PATH=./data/paintgh.db
```

If you need a fresh `JWT_SECRET`, run:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

…and paste the output as the value.

**Don't commit `.env` to git** — there's already a `.gitignore` rule blocking it.

---

## Step 5 — Create the database

This runs every migration in `db/migrations/` against a fresh SQLite file, then loads demo seed data (8 painters, 1 customer, 1 admin, sample bookings).

```bash
npm run db:reset
```

You should see something like:

```
Resetting database at: /Users/you/Projects/paint-masters/backend/data/paintgh.db
Applied 18 migration(s).
Seed: {"seeded":true,"painters":8,"others":2}
Database reset complete.
```

If the `data/` folder doesn't exist, create it first:

- **Windows:** `mkdir data`
- **Mac:** `mkdir -p data`

…then re-run `npm run db:reset`.

You can run `db:reset` any time you want a clean slate. It's destructive (deletes the DB file) so don't run it after you have real data you care about.

---

## Step 6 — Start the server

```bash
npm start
```

You should see:

```
Paint Masters API listening on http://localhost:3000
  env=development   db=./data/paintgh.db
```

Leave this terminal running. Open a browser and visit:

- <http://localhost:3000/healthz> → `{"ok":true,"ts":"..."}`
- <http://localhost:3000/readyz>  → `{"ok":true,"db":"up"}`

If both come back, the API is live.

---

## Step 7 — Verify with the smoke test

Open a **second** terminal (keep the first one running with the server). `cd` into the backend folder again:

```bash
npm run smoke
```

You should see:

```
Smoke test → http://localhost:3000

  GET /healthz … OK
  GET /readyz (db responsive) … OK
  GET /api/painters (list, no auth) … OK
  POST /api/auth/login (demo admin) … OK

4 passed, 0 failed
```

If anything fails, the most common causes are:

| Error | Fix |
|------|-----|
| `ECONNREFUSED` | The server isn't running. Check the first terminal. |
| `painters[] empty` | Seed didn't run. `npm run db:seed`. |
| `status 401` on login | Wrong demo password. The seed uses `password123`. |

---

## Step 8 — Open the customer site and admin console

The backend serves both static files (the customer pages) and the API.

- Customer homepage: <http://localhost:3000/>
- Sign in: <http://localhost:3000/login.html>
- Admin console: <http://localhost:3000/admin/index.html>

Demo credentials (the same ones the smoke test uses):

| Role | Phone | Password |
|------|-------|----------|
| Admin | `0244000000` | `password123` |
| Customer | `0244200001` | `password123` |
| Paint Master | `0244300001` | `password123` |

Sign in as the admin → you should see the dashboard. Open the customer site in a private/incognito window, sign in as the customer, fill out a quote, confirm a booking — then refresh the admin Job Board. The new booking should appear in **New Request**.

---

## Daily workflow after setup

Once everything is installed, your day-to-day is just:

```bash
cd backend
npm start
```

…and you're running locally. Stop with `Ctrl-C`.

For **live reload** (the server restarts automatically when you save a code change):

```bash
npm run dev
```

(That uses `nodemon`, already installed as a dev dependency.)

---

## Useful npm scripts

| Command | What it does |
|---------|------|
| `npm start`        | Start the API on port 3000 |
| `npm run dev`      | Start with auto-reload |
| `npm run db:migrate` | Apply any new migrations (idempotent) |
| `npm run db:seed`  | Re-run seed (idempotent — won't duplicate) |
| `npm run db:reset` | Wipe DB + re-migrate + re-seed |
| `npm run smoke`    | Hit the health endpoints, confirm green |

---

## When something breaks

**"Port 3000 is already in use."**
- Mac: `lsof -i :3000` to find the process, then `kill -9 <pid>`
- Windows: `netstat -ano | findstr :3000` then `taskkill /F /PID <pid>`
- Or set `PORT=3001` in `.env` and restart.

**"better-sqlite3" failed to load.**
- You probably switched Node versions. Run `npm rebuild better-sqlite3`.

**Database is locked.**
- You have two `node server.js` running. Kill one of them.

**Frontend can't reach the backend (CORS error in browser console).**
- The frontend in this project is served BY the backend (same origin). If you've moved the frontend to a different port, set `CORS_ORIGIN=http://localhost:5173` (or wherever) in `.env` and restart.

---

## What's next, after local works

When you're ready to put this in front of real customers:

1. Pick a host (DigitalOcean, Hetzner, AWS Lightsail, Render — all $5–10/month options work fine).
2. Push the code to a server, run the same `npm install` + `npm run db:migrate` + `npm start`.
3. Get a domain (paintmasters.gh ideally), point it at the server's IP.
4. Wire up Paystack, Hubtel SMS, and MoMo payouts (the env keys are already in `.env.example` — just fill them in with real credentials).
5. Set up `pm2` or `systemd` so the server auto-restarts on reboot.
6. Add a daily backup of the SQLite file (`backend/db/backup.sh` is ready for this — see `backend/docs/DEPLOY.md`).

Each of those is a separate ~30 minute task. You can do them one at a time and never lose access to your customers — the local setup is exactly the same shape as production.
