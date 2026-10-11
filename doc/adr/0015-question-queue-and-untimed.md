# 15. Queue questions, and let the host reveal an untimed one

Status: accepted (2026-10-11)

Supersedes the "one question at a time" scope and the "no early reveals" rule
in CLAUDE.md, and the refusal in ADR 12's "Ask again". ADR 13 still holds.

## Context

The owner asked why a host could only create one question, and wanted "as many
as they like". Asked to choose, they picked a queue: prepare several drafts,
run them one after another, like Mentimeter's or Slido's slide list. They also
asked that some questions have no time limit, with the host ending them.

Two alternatives were offered and not chosen: several questions open at once
(a survey), and a batch sharing one deadline (an EasyRetro board). Both would
turn the single "current question" in the snapshot, form, shared screen and
isolation tests into lists.

## Decision

- **Queue.** A host may create any number of drafts. At most one question per
  org is live (`COLLECTING` or `REVEALED`). Starting is refused with
  `question_live` while another is live, and a partial unique index
  (`questions_one_live_per_org`) makes two simultaneous starts end with exactly
  one success. When nothing is live, the oldest draft is offered as "Up next"
  in the stage; any draft can be started, edited or deleted from the queue.
  "Finish discussion" names the next question.
- **Drafts are host-only data.** The snapshot's `queue` is empty for members,
  `current` is never a draft, and `GET /api/questions/:id` and the history page
  return 404 to a member for a draft. Before this change members saw the single
  draft's text before it started; now nobody but the host learns a question
  before it opens.
- **Untimed questions.** `durationSec` 0 means no time limit. Starting stores no
  deadline, no timer is armed, and reconcile never reveals it. The host gets
  "Reveal answers" (`POST /api/questions/:id/reveal`). The reveal and
  submissions run in the same SQLite write transaction, so an answer either
  commits before the reveal or is refused after it. A timed question can't be
  revealed by hand (`409 timed`), so a promised window is never cut short.
- **Migration.** `0001_question_queue` swaps the one-open index for the
  one-live index and relaxes the deadline check for untimed questions, which
  rebuilds the `questions` table. Run against a copy of a populated database it
  first failed: SQLite ignores `PRAGMA foreign_keys = OFF` inside drizzle's
  transaction, so dropping the old table broke references from options and
  responses. The app now turns foreign keys off around migrations and refuses
  to start if `foreign_key_check` finds anything afterwards. On that copy all
  176 questions, 211 responses, 59 likes and 138 tags survived.

## Costs

- An untimed question depends on the host: if they leave, it stays hidden.
  README item 2 now names this exception, and the composer says so when "No
  limit" is picked.
- A host can now end answering at a moment of their choosing, which is a kind
  of influence the timed flow avoided. It applies only to questions created
  untimed, and members see "until the host reveals them" from the start.
- Drafts can't be reordered except by starting a later one first.

## How it is checked

`spec/queue.test.ts`: queue order, the live-question refusal, a concurrent
start, draft isolation in the snapshot, API, room HTML, history and shared
screen, host-only delete, untimed collection without a deadline, host-only
reveal, refusal after the reveal, no early reveal of a timed question, and
duration validation. The old one-open-question test in `spec/deadline.test.ts`
was removed as superseded.
