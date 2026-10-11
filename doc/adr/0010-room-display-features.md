# 10. Add a shared screen, QR invites, a reveal countdown and limited likes

Status: accepted (2026-10-10)

Changes the like rule in CLAUDE.md. Other decisions remain in force.

## Context

The owner asked for a survey of similar tools and then chose four ideas from
it. Mentimeter, Kahoot and Slido project a join QR code and a presenter view
on a shared screen. Miro's private mode counts down before revealing every
note at once. Parabol and EasyRetro give each person a small number of votes.
Patterns from the same tools that break this app's rules were left out:
early reveal buttons, live word clouds during collection, revealing when
everyone has answered, and named typing indicators.

## Decision

- **QR invite.** A QR button beside "Copy link" opens a native dialog with
  the invite link as a QR code (`uqr` 0.1.3, no dependencies, drawn as SVG
  without `{@html}`). The link still only fills in the join form.
- **Shared screen.** `/o/[orgId]/present`, linked for the host, uses the same
  member-only snapshot and live connection as the room. It shows the question,
  a large countdown, the submitted count and, until the reveal, the QR and
  join code for late joiners. After the reveal it shows results read-only.
  It hides the presenter's "your answer" and "your choice" markers, because
  the room would otherwise learn which answer was the host's. The site header
  is hidden and type scales with the viewport. A full-screen toggle is offered.
- **Reveal moment.** In the last three seconds the countdown becomes a large
  3-2-1. After the reveal, answer cards flip in one after another (90ms apart).
  Cards shown again by the keyword filter just appear. Reduced-motion
  preferences turn the animation off through the existing global rule. The
  countdown is still display-only; the server decides the reveal.
- **Three likes per question.** The server counts the caller's likes on the
  question's responses inside the like transaction and refuses a new fourth
  like with 409 `like_limit`. Repeating an existing like is not refused.
  The results toolbar shows "N of 3 likes left". Spent like buttons are
  dashed and do nothing. Three likes suit groups of ten to twenty and make
  people choose what is worth discussing.

## Trade-offs

A limit means a participant may not be able to like everything they agree
with. Ordering by likes still uses first-submission time for ties, as the
rules require, rather than the random tie-break some tools use. The shared
screen duplicates a little of the room's layout so the room stays unchanged.

## Verification

`pnpm build` passed. `APP_URL=http://127.0.0.1:8083 pnpm check` passed 60
tests in 11 files with zero Svelte errors or warnings. New tests:
- the like limit, including retries at the limit and freeing a like;
- the shared screen's HTML carrying no hidden answers before the reveal;
- 404 for non-members.

Headless Chrome checks with a seeded six-answer question:
- The shared screen at 1920×1080 showed the countdown, "6 responses
  submitted" and the QR code.
- With about two seconds left it showed the large "2".
- After the reveal it showed six cards, no "Your answer" marker and no
  horizontal overflow.
- At 390×844 (dark) the shared screen stacked without overflow.
- The room's QR dialog opened with focus on Close.
- A participant liked three answers. The toolbar then read "0 of 3 likes
  left" and the two remaining buttons were spent; clicking one changed
  nothing.
- macOS CoreImage decoded both QR codes to the invite link.

Not checked:
- The flip animation mid-motion, or a phone camera scanning a projected code.
- Full-screen mode, which headless Chrome cannot show.
- Classmate testing.

Screenshots: [shared screen](../../docs/design/present-collecting.jpg),
[final seconds](../../docs/design/present-final.jpg),
[revealed](../../docs/design/present-revealed.jpg),
[phone](../../docs/design/present-phone.jpg),
[QR dialog](../../docs/design/room-qr.jpg),
[likes used](../../docs/design/likes-phone.jpg).
