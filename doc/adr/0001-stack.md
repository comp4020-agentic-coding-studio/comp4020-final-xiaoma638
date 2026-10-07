# 1. Stack: SvelteKit on Node, SQLite through Drizzle

Status: accepted (2026-10-06)

## Context

CLAUDE.md fixes the stack: SvelteKit and TypeScript front and back,
`adapter-node`, SQLite, Drizzle, SSE. The course deployment is one Fly
`shared-cpu-1x` machine with 256 MB and one volume at `/data`; there is no
separate database server.

## Decision

| Piece | Version | Why |
| --- | --- | --- |
| Node | 24.21.0 | pinned in `mise.toml` and the Docker base image |
| SvelteKit | 3.0.0 | one codebase for pages and the JSON API; SSR pages work before scripts load |
| `@sveltejs/adapter-node` | 6.0.0 | a plain long-running Node server, which in-process timers and SSE need |
| Svelte | 5.57.1 | runes for the live snapshot store |
| Vite | 8.3.2 | required by SvelteKit 3 |
| SQLite (via `better-sqlite3`) | 3.53.4 (`better-sqlite3` 13.0.3) | a file on the volume; synchronous transactions make each decision atomic in one process |
| Drizzle ORM / drizzle-kit | 0.45.3 / 0.31.11 | typed schema, generated SQL migrations committed in `drizzle/` |
| marked | 18.0.14 | renders `README.md` at `/readme/` on the server |

Notes on SvelteKit 3, since it differs from most examples: config lives in
`vite.config.ts` (no `svelte.config.js`), app code is imported as `#lib/...`
through `package.json` `imports` (`$lib` is gone), hook types come from
`@sveltejs/kit/hooks`, and `tsconfig.json` extends `$app/tsconfig`.

The database opens lazily on first use, sets WAL, foreign keys and a busy
timeout, and applies pending migrations. `DATABASE_PATH` is `/data/app.db` in
the image.

## Alternatives

- **Postgres**: a second Fly app is outside the course setup.
- **`node:sqlite`** (built in, no native addon): Drizzle 0.45 has no driver
  for it. Revisit if the native build becomes a problem.
- **A separate API server (Express/Fastify) plus a static frontend**: two
  things to build and deploy for no gain at this size.

## Consequences

- One process holds the reveal timers and SSE subscribers, so the app can't
  scale past one machine. That's the course shape anyway.
- `better-sqlite3` is a native addon; the build stage carries a C toolchain in
  case no prebuilt binary matches.
- Measured: about 45 MB RSS in a 256 MB container after the full spec run
  (native arm64, 2026-10-06). Not yet measured on Fly.
