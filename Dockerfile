# ============================
# Paint Masters — production container.
#
# One image holds both the API and the static customer + admin frontends:
#   - Backend is a Node.js Express app (server.js).
#   - The frontend is plain static HTML / CSS / JS at the project root;
#     server.js already serves it via express.static(path.join(__dirname, '..')).
#
# better-sqlite3 ships prebuilt binaries for linux-x64, so `npm ci` here
# pulls the right .node file for this image without needing to compile.
# We still install python3/make/g++ as a belt-and-braces fallback in case a
# future bump ships without a prebuild for our node version — they're
# cheap and they keep the build deterministic.
# ============================

FROM node:22-bookworm-slim

# Build tools as a fallback for any native module without a linux-x64
# prebuild. ca-certificates so outbound HTTPS to Hubtel / Resend / etc.
# validates correctly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies first so this layer caches independently of
# code changes. Only `npm ci` if the package manifest actually changed.
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev && npm cache clean --force

# Copy the rest of the project — static frontend at /app/, backend at
# /app/backend/. `.dockerignore` excludes node_modules, .env, the SQLite
# DB file, the uploads dir, and the QA screenshots so the image stays slim.
COPY . ./

# Persistent state goes under /data, mounted as a volume by docker-compose.
# We pre-create the layout and chown to the unprivileged `node` user; named
# volumes inherit image content (and ownership) on first mount, so the
# container can write here without running as root.
RUN mkdir -p /data/uploads \
 && chown -R node:node /app /data

USER node
WORKDIR /app/backend

# The server listens on 3000; the compose file maps this to host 3000.
EXPOSE 3000

# Container health probe. Docker / Kubernetes / Swarm use this to know
# when the API is actually serving — GET /api returns the JSON catalog
# once Express + migrations have come up.
HEALTHCHECK --interval=30s --timeout=10s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Migrations run on boot (server.js -> require('./db/migrate').runAll()) so
# a fresh /data volume gets the full schema applied automatically the first
# time the container starts.
CMD ["node", "server.js"]
