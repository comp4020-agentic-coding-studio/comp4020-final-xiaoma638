# 5. Keep entry, saved answers and local drafts distinct

Status: accepted (2026-10-07)

## Context

The home page put hosting beneath a long introduction and a separate joining
form. This made the host's first action expensive to find on a phone. The core
review flow had more consequential feedback problems: a completed request
could replace text entered while saving, and revealing results unmounted an
editor with unsaved content. An open event stream was also labeled live even
when the snapshot request failed.

## Decision

- Keep the existing paper, serif heading and colored note visual language.
  Put joining and hosting in one clearly labeled switchable entry panel.
  Keep form values when switching; put the detailed walkthrough below entry.
  The decorative sample wall is labeled as an example and omitted on phones.
- Use “review space” consistently in the interface while retaining organization
  names in the API and storage model. Explain the browser identity limitation
  at entry. Show existing memberships as direct return links.
- Give draft editing a cancel action, freeze composer fields during saving,
  and make phase instructions specific to open answers or choices. Enlarge
  small controls and retain visible keyboard focus.
- Reconcile response acknowledgements with the submitted values. If the user
  typed more while saving, preserve those changes and explicitly say that
  they still need to be submitted. Clear stale success feedback when editing.
- Keep response editors mounted for the page visit after reveal and closure.
  Only editors with remaining local drafts render recovery cards; confirmed
  answers remain in the results. Recovery cards offer copying and dismissal,
  and identify the previous question when the host moves on.
- Display “Up to date” only after the current server snapshot is received.
  Retry snapshot failures independently of SSE, and cancel resources on exit.
  Development module disposal closes streams tied to the old notification bus.

## Alternatives and costs

Two simultaneous entry forms avoid a switch but push hosting down the page.
Disabling answer input during a request would be simpler, but would interrupt
people who are still thinking; acknowledgement reconciliation preserves input.
Storing unsubmitted answers in the database would conflict with explicit
submission. Recovery instead lasts only for this page visit, not a reload.
Keeping editors mounted costs a small amount of session memory per question.

## Verification

`pnpm build` and `APP_URL=http://127.0.0.1:8082 pnpm check` passed on a local
production build with a separate temporary SQLite database: 53 tests in 10
files, including 7 response-draft cases and 10 snapshot-recovery cases.
The response cases cover input changed during saving and distinguishing a
local revision from its counted answer. Network cases use mocked event streams
and requests; they are not measurements of production network reliability.

Browser checks on the production build used independent host and participant
identities. Joining, saving, automatic reveal, liking, closing and reloading
history were exercised; draft cancellation was checked in the development
preview. Both an entirely unsubmitted
answer and an unsaved revision stayed available after reveal; the participant
copied the revision after the host closed the discussion. The earlier saved
answer and its like were still present after reloading history.

The home page was inspected at 1920×1080 and 390×844 with no horizontal
overflow. On the phone, the join button ends at approximately 784 px, within
the first viewport. Tab and Enter operated the entry switch with visible
focus. These are developer checks, not claims of peer usability testing.

Screenshots: [desktop](../../docs/design/home-desktop.jpg),
[phone](../../docs/design/home-mobile.jpg),
[draft retained after closure](../../docs/design/draft-recovery.jpg).

The course evidence check still fails because the original PROCESS template,
placeholder commit citations and missing crit reflection remain. This decision
record does not replace the student's README argument or process reflection.
