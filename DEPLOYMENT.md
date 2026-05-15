# Paint Masters — Deployment guide

Goal: take this codebase from "works on the laptop with seed data" to "live on the internet, accepting real customers." Following this guide end-to-end takes about a half-day for a developer who's set up Node + a Linux server before.

---

## What you're deploying

Two things that ship independently:

1. **The static frontend** — every `.html` file at the project root, plus `assets/` and `admin/`. Serves over plain HTTPS. No Node runtime needed.
2. **The Node backend** — `backend/` directory. Express + better-sqlite3. Exposes `/api/*`. Runs as a long-lived process.

You can host them together (the existing `backend/server.js` already serves the static frontend out of the project root via `express.static`) or split them — the frontend onto a static host (Netlify, Vercel, Cloudflare Pages, S3+CloudFront) and the backend onto a small VM or container service. **Together is simpler for the first launch.**

---

## Pre-launch checklist

Run through this in order. Each step has a "done when" so you know it's complete.

### 1. Wipe demo data on every device that has touched the platform

Local-only data lives in browser localStorage. Sign in as admin, go to **Settings → Data**, and either:
- Tick every row in "Local data on this device" and hit "Wipe selected", or
- Hit the bigger "Reset to clean production state" button (recommended pre-launch).

Done when: the bell + Live activity feed are empty, the kanban shows zero jobs, the customers list is empty.

### 2. Switch every HTML page to production mode

Production mode is controlled by a single meta tag in each HTML head:

```html
<meta name="pm-mode" content="production">
```

When the meta is absent or set to `demo`, the platform seeds itself with sample data and lets `PM_DEMO_USERS` sign people in via the local fallback. In `production`:
- New stores hydrate empty.
- The local-fallback login is disabled — only your real backend can sign someone in.
- Painter dashboards skip the demo-job seed.

Files to edit (every customer + admin HTML page):

```
index.html  brand.html  paints.html  services.html  about.html  artisans.html
booking.html  quote.html  register.html  login.html  change-password.html
track.html  my.html  painter.html  warranty.html
admin/index.html  admin/jobs.html  admin/artisans.html  admin/customers.html
admin/inventory.html  admin/analytics.html  admin/approvals.html
admin/support.html  admin/team.html  admin/settings.html
```

Done when: every page has the meta tag and Settings → Data shows the green "🟢 Production" badge.

### 3. Set backend env vars

Copy `backend/config/env.example` to `backend/.env` and fill in real values:

```
NODE_ENV=production
PORT=3000

# Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=<48+ random chars, never commit>
JWT_EXPIRES_IN=7d

DB_PATH=/var/lib/paintmasters/paintgh.db   # absolute path on the server

# CORS — comma-separated list of frontend origins. Empty = allow all (DON'T in production).
CORS_ORIGINS=https://paintmasters.gh,https://www.paintmasters.gh

# Hubtel — see backend/docs/PAYMENTS.md.
HUBTEL_CLIENT_ID=...
HUBTEL_CLIENT_SECRET=...
HUBTEL_MERCHANT_ACCOUNT=...
HUBTEL_CALLBACK_URL=https://paintmasters.gh/api/payments/callback
HUBTEL_CALLBACK_SECRET=...
HUBTEL_MODE=                # leave empty for live (when keys set); 'stub' for test deploys
HUBTEL_SENDER_ID=PaintGH

# Optional — email + uploads
EMAIL_PROVIDER=             # resend | sendgrid | mailgun
EMAIL_API_KEY=
EMAIL_FROM=no-reply@paintmasters.gh
UPLOADS_DRIVER=local        # local | s3 | r2
UPLOADS_LOCAL_DIR=/var/lib/paintmasters/uploads

LOG_LEVEL=info
```

Done when: `node -e "require('./backend/config')"` runs without throwing on the server.

### 4. Provision the database

```bash
cd backend
npm ci --production
node db/migrate.js                # applies migrations 001-020
```

Important: **do not run `node db/seed.js`** in production — that's the demo seed. Migrations alone produce an empty schema ready for real users.

Done when: `sqlite3 $DB_PATH ".tables"` lists the 30+ tables and `_migrations` shows 20 rows.

### 5. Create the first admin user

The platform has no UI signup for admins (deliberate). Use the seed script with explicit args:

```bash
cd backend
node scripts/create-admin.js --phone 0244000000 --name "Founder Admin" --email founder@paintmasters.gh
```

This generates a temporary password, prints it, and flags `mustChangePassword=1` so the first sign-in forces a rotation.

Done when: you can sign in at `/login.html`, get redirected to change-password, set a new password, and land on the admin dashboard.

### 6. Boot the backend as a long-lived process

The simplest pattern is `systemd`. Drop this in `/etc/systemd/system/paintmasters.service`:

```ini
[Unit]
Description=Paint Masters API
After=network.target

[Service]
Type=simple
User=paintmasters
WorkingDirectory=/srv/paintmasters/backend
EnvironmentFile=/srv/paintmasters/backend/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl enable --now paintmasters
sudo systemctl status paintmasters
curl http://localhost:3000/api          # should return the JSON API banner
```

Done when: `systemctl status` is green and `/api` returns the banner.

### 7. Front it with HTTPS

Either a reverse proxy (nginx + certbot) or a managed cert from your cloud provider. Recommended nginx site config:

```nginx
server {
  listen 443 ssl http2;
  server_name paintmasters.gh www.paintmasters.gh;

  ssl_certificate     /etc/letsencrypt/live/paintmasters.gh/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/paintmasters.gh/privkey.pem;

  client_max_body_size 5m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name paintmasters.gh www.paintmasters.gh;
  return 301 https://$host$request_uri;
}
```

Done when: `https://paintmasters.gh/` returns the homepage and `https://paintmasters.gh/api` returns JSON.

### 8. Hubtel webhook

In the Hubtel merchant portal, set the callback URL to:

```
https://paintmasters.gh/api/payments/callback
```

And the callback secret to whatever you put in `HUBTEL_CALLBACK_SECRET`. Test with a small MoMo charge in stub mode first (`HUBTEL_MODE=stub`), then flip to live once the loop is verified.

Done when: a test charge succeeds and the booking's `payment_status` flips to `paid` in the DB.

### 9. Point DNS

A record for `paintmasters.gh` and `www.paintmasters.gh` to the server's public IP. Confirm with `dig paintmasters.gh +short`.

Done when: the domain resolves and HTTPS is green in the browser.

---

## Day-2 ops

### Backups

The DB lives at `$DB_PATH`. A nightly cron is fine for the first months:

```bash
0 2 * * * sqlite3 /var/lib/paintmasters/paintgh.db ".backup '/var/backups/paintmasters/$(date +\%Y-\%m-\%d).db'"
```

Rotate weekly to keep backup size sane.

### Logs

`journalctl -u paintmasters -f` follows the live log. The Node app writes to stdout via the structured logger; Helmet headers are on, CSP is off (the inline `<style>`/`<script>` blocks need it off for now — TODO is to extract them).

### Updates

```bash
cd /srv/paintmasters
git pull
cd backend && npm ci --production && node db/migrate.js
sudo systemctl restart paintmasters
```

The migration runner is idempotent; only new migrations apply.

### Monitoring

The backend exposes `GET /api/health` (basic 200/JSON). Wire it into uptime-robot, Better Uptime, or whatever you use. Set the alert threshold at 30 seconds.

---

## Rolling back demo data after launch

If the dispatcher accidentally creates a real customer with a typo or the wrong Master is assigned to a hundred jobs, **nothing here gives them a magic undo**. Use:

- The **deleted-jobs** view (Jobs → "Show deleted") to restore soft-deleted rows.
- The **activity log** to see who did what and when.
- A SQL session as a last resort. Take a backup before SQL surgery.

---

## What's NOT in this round

These are tracked in `backend/docs/PAYMENTS.md` and the open-items list — they don't block launch but they're the obvious next sprints:

- Phase 2 of the Hubtel integration (painter payouts via Send Money, monthly payroll with PAYE+SSNIT, escrow holdback release job).
- Real notifications outbox (replaces the `pmComms` deep-link handoff with server-side delivery via Hubtel).
- Email integration via Resend/SendGrid (currently a stub).
- File uploads to S3/R2 (currently localStorage data URLs).
- Per-brand landing-page customisation in admin (currently the brand registry is code, not data).

---

## Demo credentials (still active in dev)

These work in `demo` mode only — when you flip to `production`, the local fallback is disabled and the seeds clear, so these stop working:

- Admin: `0244000000` / `password123`
- Customer: `0244200001` / `password123`
- Painter: `0244300001` / `password123`

Use them for QA on a non-production deployment; never seed them in the real DB.
