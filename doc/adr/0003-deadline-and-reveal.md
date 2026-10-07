# 3. The server's clock decides the deadline; reveals are idempotent

Status: accepted (2026-10-06)

## Context

Answers must be refused at or after the deadline, whatever the client's
clock says. Reveals must happen with the host offline and survive restarts
(the machine auto-stops when idle). A late timer must not stretch the window.

## Decision

- Each write runs in one `BEGIN IMMEDIATE` transaction and takes `Date.now()`
  inside it as the decision time. A response is accepted only if
  `decidedAt < deadline` (`acceptsAt` in `src/lib/domain/rules.ts`). Since one
  process serialises the transactions, a save and a reveal can't interleave.
- The phase is computed as well as stored: a stored `COLLECTING` past its
  deadline *is* `REVEALED` (`effectivePhase`). Every read and write first runs
  `reconcile`, an `UPDATE … WHERE phase = 'COLLECTING' AND deadline <= now`
  that sets `revealed_at = deadline`. Repeating it changes nothing, so a timer,
  a read and startup can all call it without revealing twice.
- A `setTimeout` per collecting question fires 1 ms after the deadline and
  reconciles, which is what pushes the reveal to idle clients. At startup the
  app reconciles everything expired and re-arms the rest.
- A refused late write still commits the reveal it found, by returning the
  refusal from the transaction and throwing after it.
- One response per identity per question is a unique index. Edits carry the
  version they're based on; a mismatch is a 409 that returns the saved answer,
  unless the stored answer already equals the submitted one (a retry), which
  counts as success.

## Alternatives

- **Trusting a client timestamp**: forgeable, and clocks drift.
- **Only a timer, no reconcile**: a restart or a stopped machine would leave
  questions collecting forever.
- **A job queue**: one more moving part for what a timer plus reconcile covers.

## Consequences

- Verified by hand on 2026-10-06: a `kill -9` while collecting, then a restart
  after the deadline, logs `question_revealed` with `trigger: "startup"` and
  `revealed_at` equal to the deadline; a closed question stays closed across a
  restart. Not yet automated, because the spec can't restart the app it tests.
- The spec checks accept-before/refuse-after, a burst of writes straddling the
  deadline, and that a reveal happens with no client connected
  (`spec/deadline.test.ts`).
