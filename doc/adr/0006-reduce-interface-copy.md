# 6. Keep the current task visible and move secondary detail into disclosures

Status: accepted (2026-10-07)

Supersedes the entry walkthrough, example wall and persistent explanatory copy
from [decision 5](0005-entry-and-feedback.md). Its draft protection and connection
recovery decisions remain in force.

## Context

After the first design pass, the project owner said: “界面文字信息太多太杂了
做好美化 做到简洁清楚可见” — the interface had too much cluttered text and
needed to be simpler and clearer. This is direct owner feedback, not a claim
of independent peer testing.

## Decision

- Keep the home page to a title, one short description, the Join/Host form and
  return links. Remove the textual example cards and the always-visible
  walkthrough. Preserve the paper-card visual motif without sample prose.
- Put the walkthrough and browser identity explanation behind “How it works”.
  Keep the entry action within the first phone viewport.
- Use one phase badge with one short instruction. Put the question next,
  followed by the countdown, submitted count and response controls. Remove
  repeated statistics, multi-step phase diagrams and redundant success text.
- Replace the duration button grid with a labeled native select. Keep explicit
  labels, touch targets, keyboard focus, draft cancellation and server feedback.
- Put optional keywords, vote-count explanations and privacy details behind
  native details/summary controls. Keep errors, unsaved changes and draft
  recovery visible when they matter. Do not hide these in general help.

## Trade-offs

Secondary information takes an extra action to discover. Short labeled
disclosures retain access without competing with the current task. The
countdown communicates remaining time without repeating an absolute timestamp
and a second progress visualization.

## Verification

`pnpm build` passed. `APP_URL=http://127.0.0.1:8082 pnpm check` passed all
53 tests in 10 files, with zero Svelte errors or warnings. Tests ran against
the local production build using a separate temporary database.

The home page was inspected at 1920×1080 and 390×844 with no horizontal
overflow. The phone Join action was visible in the first viewport. Keyboard
Enter expanded and collapsed the help disclosure; switching to Host exposed
the correct labeled form. The mobile room also had no horizontal overflow.
A single-choice draft with a 30-second duration was created, started and
answered through the UI; the saved indicator and submitted count updated.
Automatic reveal displayed the expected 1/0 vote counts and 100%/0% shares.
The counting disclosure expanded correctly. A zero-vote bar has zero width.

Screenshots: [desktop entry](../../docs/design/home-minimal-desktop.jpg),
[phone entry](../../docs/design/home-minimal-mobile.jpg),
[phone answering](../../docs/design/room-minimal-mobile.jpg),
[desktop results](../../docs/design/room-minimal-desktop.jpg).

These checks evaluate implementation and layout; peer usability testing and
the outstanding course reflection/evidence work remain separate.
