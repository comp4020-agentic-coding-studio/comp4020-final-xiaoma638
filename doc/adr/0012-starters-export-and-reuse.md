# 12. Add question starters, quick durations, result export and "Ask again"

Status: accepted (2026-10-11)

Adds to the host and results screens. Other decisions remain in force.

## Context

The owner asked for a second survey of similar tools, keeping the app simple.
Mentimeter and EasyRetro open with ready-made questions (EasyRetro's
Start/Stop/Continue boards; Mentimeter's templates) and Mentimeter starts a
timer with one key press. Mentimeter, Slido and EasyRetro all export results
to a spreadsheet, and Mentimeter duplicates a slide so a question can be asked
again. The shared screen, QR invite, likes and reveal countdown from ADR 0010
already cover the rest of what these tools offer this kind of group.

## Decision

- **Starters.** A new (not edited) question offers four starter chips while
  the question box is empty: three open prompts and a three-option confidence
  check. Picking one fills the type, text and options and focuses the text. The
  chips disappear as soon as there is text, so they never overwrite typing.
- **Quick durations.** The duration select becomes a row of native radios
  (30s to 10m) styled like the type switch, so the time is one tap and visible
  at a glance. A draft saved with another duration keeps it as an extra chip.
- **Export.** Once results are revealed and at least one answer exists, the
  room and history pages offer "Copy summary" (plain text, open answers ranked
  by likes with the same comparator as the wall) and "Download CSV". Both are
  built in the browser from the results the viewer already has, so they carry
  no nicknames or author ids and need no new endpoint. CSV cells starting with
  `= + - @` are prefixed with `'` so spreadsheets don't run them as formulas,
  and the file starts with a UTF-8 byte-order mark so Excel shows Chinese text.
- **Ask again.** A host on a closed question's page can copy it into a new
  draft through the existing create endpoint. The server's one-open-question
  rule still applies and its refusal is shown in place. The page now takes its
  org from the question (`historyDetail`), not the URL.

## Consequences

- No schema, API or permission changes. Export is a client-side view of data
  members can already read, so isolation before the reveal is unchanged.
- The export rules are unit-tested in `spec/unit/export.test.ts`.
