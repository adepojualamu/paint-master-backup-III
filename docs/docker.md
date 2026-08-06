# Running Paint Masters on Docker (Windows-friendly)

The project was built on macOS but ships as a single Linux container, so
you can run the exact same image on Windows, macOS, or Linux without
worrying about the macOS-specific `better-sqlite3` native binary.

## What you need

- **Windows 10 / 11 with Docker Desktop** (uses the WSL2 backend by
  default). Get it from <https://www.docker.com/products/docker-desktop>.
- About **1 GB of free disk** for the image and the SQLite database +
  uploaded photos.

On macOS or Linux, Docker Desktop or a plain Docker Engine works the same
way — the commands below don't change.

## First-time setup

1. **Get the project**. Clone or unzip the repo somewhere convenient. On
   Windows, anywhere under your user folder (e.g.
   `C:\Users\you\paint-masters`) is fine.

2. **Create a `.env`** by copying the template that ships in the repo:

   ```powershell
   # PowerShell
   Copy-Item .env.example .env
   ```

   ```bash
   # Git Bash / WSL / macOS / Linux
   cp .env.example .env
   ```

3. **Generate a JWT secret** and paste it into `.env`:

   ```bash
   docker run --rm node:22-bookworm-slim node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Open `.env` and set `JWT_SECRET=<the-output-above>`. This is the only
   required value; everything else has a safe default. Provider keys
   (Hubtel SMS, email, payments) can stay blank until you want real
   delivery — the senders run in record-only mode without them.

4. **Build and start**:

   ```bash
   docker compose up -d --build
   ```

   First build takes 2–4 minutes (pulling the Node base image and
   installing dependencies). Subsequent rebuilds are seconds when only
   code changes.

5. **Open** <http://localhost:3000>. The customer site is at `/`, the
   admin console at `/admin/`, the API at `/api`. The container runs
   migrations on first boot, so the SQLite schema is ready immediately.

## Where data lives

A named Docker volume called `paintmasters-data` holds:

- `/data/paintgh.db` — the SQLite database
- `/data/uploads/` — customer space photos, painter portfolio photos, etc.

You can list the volume with `docker volume ls` and inspect it with
`docker volume inspect paintmasters-data`. To wipe everything and start
fresh:

```bash
docker compose down -v
```

`-v` removes the volume too. Without it, `docker compose down` stops the
container but keeps the data.

## Updating the code

After editing source files (frontend or backend), rebuild and recreate
the container:

```bash
docker compose up -d --build
```

The volume is untouched so the database and uploads persist.

## Logs

```bash
docker compose logs -f paintmasters
```

The container writes structured logs to stdout — `docker compose logs`
streams them; in production you'd ship them to your log aggregator the
usual way.

## Health and readiness

The container exposes an HTTP healthcheck on `/api`. Docker reports the
status as part of `docker ps`:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

The `Status` column will read `healthy` once the API is serving (a few
seconds after migrations apply on first boot).

## Production deploy

For a real-world deploy in front of users, plus the steps above:

- Put a TLS-terminating reverse proxy (nginx, Caddy, Cloudflare) in
  front of port 3000. The app refuses non-HTTPS requests in production
  (`NODE_ENV=production`), so the proxy must set `X-Forwarded-Proto:
  https` on the way through.
- Set `CORS_ORIGINS` in `.env` to your real frontend origin(s).
- Fill in the Hubtel + email credentials in `.env` so notifications
  actually deliver.
- Set `HUBTEL_CALLBACK_SECRET` to match the value configured in your
  Hubtel portal so the payment callback HMAC verification passes.
- Schedule a regular backup of the named volume (e.g.
  `docker run --rm -v paintmasters-data:/data -v $(pwd):/backup
  alpine tar czf /backup/paintmasters-$(date +%F).tar.gz /data`).

## Troubleshooting

**`Error: JWT_SECRET must be set in the host .env file`**: the .env file
either doesn't exist next to docker-compose.yml or doesn't have a
non-empty `JWT_SECRET`. The fail-closed behaviour is intentional.

**Port 3000 already in use**: change the host side of the port mapping
in `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"   # serve on host port 8080 instead
```

Then `docker compose up -d`.

**Windows file-watch / line endings**: the image runs on Linux so it
doesn't care about CRLF line endings in source files. If you edit code
on Windows in a CRLF-converting editor (most are LF by default but check
your settings), nothing in the image breaks.

**Permission errors on the volume**: named Docker volumes inherit the
image's ownership on first mount, and the image chowns `/data` to the
unprivileged `node` user, so writes from inside the container succeed.
If you swap to a bind mount (`./data:/data`), you'll need to manage
ownership on the host — usually easiest to stick with the named volume.
