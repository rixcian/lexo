# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────────
# deps - install node_modules. better-sqlite3 is a native addon, so the image
# carries a toolchain in case no prebuilt binary matches this Node ABI.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ──────────────────────────────────────────────────────────────────────────────
# builder - produce the standalone server bundle
# ──────────────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ──────────────────────────────────────────────────────────────────────────────
# runner - the image that actually ships
# ──────────────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    ANKI_DB_PATH=/data/anki.db \
    ANKI_MIGRATIONS_DIR=/app/drizzle

RUN apt-get update \
  && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data \
  && chown -R node:node /data

# `output: "standalone"` traces exactly the files the server needs, including
# the compiled better-sqlite3 binding.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Migrations run on first DB access, so they must be in the image.
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
