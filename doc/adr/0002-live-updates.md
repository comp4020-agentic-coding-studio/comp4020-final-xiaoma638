# 2. Live updates: SSE carries version numbers, clients fetch snapshots

Status: accepted (2026-10-06)

## Context

Changes have to reach other open sessions within about a second. Before the
reveal nothing that travels to a browser may carry anyone else's answer, and
different viewers see different things (only you see your own answer).

## Decision

- Every write bumps the org's `version` inside its transaction and publishes
  `{"version": N}` on an in-process bus **after commit**.
- `GET /api/orgs/:id/events` is an SSE stream for members only. It sends the
  current version on connect, then each new version, plus a heartbeat
  comment every 15 s.
- On any version newer than its own, and on every (re)connect, the client
  fetches `GET /api/orgs/:id/snapshot`, which is filtered for that viewer.
  Fetches are coalesced, and a snapshot with a lower version than the one
  held is dropped, so an old reply can't overwrite newer state.
- On SIGTERM the server ends all streams and reveal timers so a redeploy
  doesn't wait out open connections. Clients reconnect and resync.

## Alternatives

- **Pushing state in the stream**: a stream per viewer would need its own
  permission filtering on every event, so one mistake leaks answers. A version
  number can't leak anything.
- **WebSockets**: nothing needs client-to-server messages on the socket. SSE
  is plain HTTP, reconnects by itself, and passes through Fly's proxy.
- **Polling**: simpler, but it costs a request per client per second, and it
  keeps the auto-stopping machine awake.

## Consequences

- Each change costs every connected client one snapshot fetch. That's fine
  for a room-sized group. The 20-concurrent-participant target in CLAUDE.md
  hasn't been measured yet.
- The spec checks that a submission notification arrives within 1 s locally
  and that stream data only ever has a `version` key (`spec/realtime.test.ts`).
