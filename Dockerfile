# syntax = docker/dockerfile:1

# The SvelteKit app, built with adapter-node and run as one Node process. It
# serves HTTP on 0.0.0.0:$PORT (fly.toml sets PORT) and keeps its SQLite
# database on the Fly volume at /data, the only storage that survives a
# restart or a redeploy. Pending migrations run at startup.

FROM docker.io/library/node:24.21.0-slim AS build
WORKDIR /app
# toolchain in case better-sqlite3 has no prebuilt binary for this platform
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM docker.io/library/node:24.21.0-slim
WORKDIR /app
ENV NODE_ENV=production \
    DATABASE_PATH=/data/app.db \
    MIGRATIONS_DIR=/app/drizzle \
    # Fly's proxy terminates TLS and says so in this header
    PROTOCOL_HEADER=x-forwarded-proto \
    # the machine has 256 MB; leave room for SQLite and the runtime
    NODE_OPTIONS=--max-old-space-size=160
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/README.md ./
COPY --from=build /app/docs ./docs
CMD ["node", "build"]
