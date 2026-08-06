# Paint Masters — Security Notes

This document records the deliberate security tradeoffs in the current
codebase: why each one looks the way it does, what it costs, and what would
have to change to remove the cost. It's a companion to the standard
`backend/README.md` deploy notes, focused on the "yes I know" decisions.

Last reviewed: 2026-06-13.

## JWT in localStorage on the frontend

The customer site and admin console store the signed-in user's JWT in
`window.localStorage` (`pmAuth.set` / `pmAuth.token` in `assets/shared.js`).
Every authenticated `fetch` reads it from there and sends it as
`Authorization: Bearer …`.

This is the conventional pattern for a single-page application that talks to
a same-origin API, and it has two important properties:

- It is **CSRF-safe by construction**. A token only attaches to a request
  when our own JavaScript reads it from `localStorage` and sets the header.
  Cross-origin pages can't trick the browser into sending it, so we don't
  need CSRF tokens, double-submit cookies, or `SameSite` games.
- It is **vulnerable to any successful XSS**. Anything that runs in our
  origin — a stored XSS in a customer-supplied field, a reflected XSS in an
  error page, a compromised third-party script — can read every token and
  hand it to an attacker.

While that tradeoff is in place, the load-bearing defence is the
Content-Security-Policy in `backend/server.js`. It allows our inline scripts
(`'unsafe-inline'` for `script-src`) but locks all other script sources to
`'self'`, so a successful injection still can't load `<script
src="https://attacker/x.js">`. That's not nothing, but it doesn't stop
inline payloads, so the goal is still to keep both stored and reflected XSS
out.

The alternative is to deliver the token in an `HttpOnly; Secure; SameSite=Strict`
cookie. That makes the token unreadable from JavaScript and is the correct
shape for a high-trust setting. Switching costs:

- Every server-mutating route would need a CSRF defence (`SameSite=Strict`
  blocks most cross-site POSTs, but state-changing GETs and form posts to
  the API still want a per-session token).
- Every frontend fetch would need `credentials: 'include'` and a CSRF token
  in a header.
- The login/logout flows have to issue and clear cookies instead of
  returning a JSON token body.

Worth doing before high-value money moves through the platform; not worth
doing today.

## Anonymous quotes use the quote id as a bearer token

`GET /api/quotes/:id`, `POST /api/quotes/:id/photos`, and
`GET /api/quotes/:id/photos/:photoId` all accept the request as long as the
quote id is correct. There is no per-quote auth check — the id itself is
treated as a hard-to-guess credential.

This is a deliberate concession to the customer flow: a customer can build
a quote on `quote.html` before they've created an account, finalize it on
`booking.html`, and only sign in when they want to track the job. If those
endpoints required a session, anonymous quoting would break.

The mitigations we rely on:

- Quote ids are produced by `utils/ids.quoteId()`, which is meant to be
  unguessable. If that changes (sequential ids, short alphabets), the
  bearer-token assumption fails and every anonymous endpoint becomes
  enumerable.
- Photo uploads are hard-capped at `MAX_PHOTOS_PER_QUOTE = 8` per quote
  (`routes/quotes.js`). An attacker who guessed a quote id can fill 8 photo
  rows for it, no more.
- Multer caps each file at 8 MB and rejects non-image MIME types. The
  server only serves the file back with the stored `Content-Type`, and
  helmet's default `X-Content-Type-Options: nosniff` prevents the browser
  from interpreting a hostile JPEG as a script.

If quote ids ever leave Paint Masters control (shared in an email, copied
into a screenshot uploaded elsewhere), they should be treated as a
credential exposure for that one quote.

## CSP allows inline scripts and styles

The CSP in `server.js` is `script-src 'self' 'unsafe-inline'` and
`style-src 'self' 'unsafe-inline'`. That means a successful HTML injection
into one of our pages can still execute arbitrary JavaScript — the
"`'unsafe-inline'`" name is the spec being honest about that.

We're not in a position to remove it today because every HTML file in the
project carries large `<style>` and `<script>` blocks. The path to a
nonce-based CSP is:

1. Move the inline JS in `index.html`, `quote.html`, `booking.html`,
   `painter.html`, `track.html`, `admin/*.html` into separate `.js` files
   served from the same origin.
2. Move the inline CSS into separate `.css` files (or scope per-page CSS
   into the existing `assets/styles.css` and `admin/assets/admin.css`).
3. Drop `'unsafe-inline'` from `script-src` and `style-src` and add a
   per-request `'nonce-…'` for the rare cases we keep inline.

Big refactor; not urgent while the rest of the stack is still settling.

## Painter check-in is local-only

The painter dashboard's "Check in" button does not call the backend — there
is no `/check-in` endpoint, because the booking lifecycle goes
`confirmed → qa_pending` directly. Marking on-site locally is purely UX, and
the next API refresh resets the visible stage. This is documented in
`painter.html` (search for "no backend endpoint for check-in") and is not a
security issue but is sometimes mistaken for one.

## Reset-password delivery

`POST /api/admin/users/:id/reset-password` does **not** return the temp
password in the response body. It dispatches it to the user's registered
phone via `services/sms`. In development with no Hubtel credentials, the
sender runs in record-only mode and writes the message to the `sms_log`
table — the admin can read it from there until real SMS is wired up. In
production, the password is never visible outside the SMS itself.

## Data in transit

Every byte that crosses the wire is encrypted or signed:

**Inbound — browsers and clients to our API.** Production runs behind a
TLS-terminating reverse proxy. `server.js` sets `app.set('trust proxy', 1)`
so Express reads the original scheme from `X-Forwarded-Proto`, and a
production-only middleware closes the plaintext window the proxy might
leave open: HTTP `GET` / `HEAD` get a `301` redirect to `https://`,
everything else returns `403 HTTPS is required` — so a stale curl pipe or
a misconfigured cron can never accidentally send a Bearer token, a
password, or a payment payload in cleartext. HSTS (`max-age=31536000`,
`includeSubDomains`, `preload`) tells every browser that successfully
reached HTTPS once never to come back any other way; this header is
emitted by helmet for the lifetime of the connection.

**Inbound — the Hubtel webhook.** `POST /api/payments/callback` is
unauthenticated by design (Hubtel doesn't sign in to us), so authenticity
relies on the shared secret. `services/payments.parseCallback` reads the
`HUBTEL_CALLBACK_SECRET` from config, computes HMAC-SHA256 over the
exact request bytes (the rawBody captured by `server.js`'s `express.json`
verify hook — re-parsing would re-order JSON keys and break the hash), and
compares against the `x-hubtel-signature` header with `crypto.timingSafeEqual`.
A missing header, a missing secret, or a length mismatch all reject with
`400`. Without that secret an attacker who knows the URL still can't post
a fake "payment received" — the constant-time compare makes timing-based
guesses impractical.

**Outbound — to providers.** Every external call in the codebase uses
HTTPS:

- Hubtel SMS: `https://smsc.hubtel.com/v1/messages/send` (`services/sms.js`).
- Hubtel Receive Money: `https://rmp.hubtel.com/...` and
  `https://api.hubtel.com/...` (`services/payments.js`).
- Resend: `https://api.resend.com/emails`.
- SendGrid: `https://api.sendgrid.com/v3/mail/send`.
- Mailgun: configurable base `https://api.mailgun.net` (or `api.eu.mailgun.net`
  for EU accounts) — `MAILGUN_BASE_URL` validates as `https://...` in
  `services/email.js`.

Node's built-in `fetch` uses TLS 1.2+ by default; we don't override the
agent, don't disable certificate verification, and don't pin to a specific
provider domain at the cert level — failure modes there would surface as
connection errors, not silent downgrades.

**Token in transit.** The JWT is sent in `Authorization: Bearer …` on every
authenticated request — never in a URL parameter, query string, or
form body — so it doesn't show up in proxy access logs, the browser's
history, or the `Referer` header of a third-party link. Combined with the
HTTPS gate, that's the full path the token takes.

## Things that are NOT defended today

These remain genuine gaps and should be addressed before real users:

- **Account enumeration on `/api/auth/login`.** The endpoint distinguishes
  "no such user" from "wrong password" in its response copy. The rate
  limiter on `/api/auth` (10 requests / 15 min / IP) softens this but
  doesn't fix it.
- **Pricing reconciliation between the client and the server.** The
  customer-facing quote shown in `quote.html` is computed client-side using
  a multiplier model; the server stores its own number from
  `services/pricing.js`. They aren't yet identical. The server-side number
  is what gets paid, so the worst case is a customer surprised by the price
  on their bill — not a money loss, but a trust issue.
- **Painter view photo loading is per-popover.** When a painter opens a job
  detail, we hit `GET /api/bookings/:id` to fetch the quote photos. A
  painter is authorized for their own bookings, but if a dispatcher
  reassigns a job mid-day the old painter still has the booking id in
  their local state and could refetch its detail until the next list
  reload. Low-impact: same data they had a second ago.
