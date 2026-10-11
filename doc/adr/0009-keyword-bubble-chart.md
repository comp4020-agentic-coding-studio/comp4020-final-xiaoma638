# 9. Draw keywords as a bubble chart that filters the answers

Status: accepted (2026-10-10)

## Context

CLAUDE.md asks for a keyword bubble chart after the core flow works: bubble
area proportional to frequency, a text frequency list alongside, no
overlapping labels and small bubbles that remain usable targets. The revealed
results only showed a frequency bar list. The project owner asked for the
bubble chart. A survey of similar tools (AhaSlides word clouds, Mentimeter,
EasyRetro) also suggested making a keyword select the answers that use it.

## Decision

- `bubbleDiameters` in `rules.ts` gives the least frequent keyword a 44px
  diameter and scales the rest by the square root of the frequency ratio, so
  area stays proportional. If the largest bubble would pass 160px, every
  bubble shrinks by the same factor; the 44px button keeps the touch target.
- Bubbles sit in a wrapping row with the label and count below each one, so
  labels cannot overlap at any width. The number inside each bubble and the
  existing frequency list explain size in text.
- Each bubble is a toggle button. Selecting one filters the wall to answers
  carrying that keyword and shows "N of M tagged #keyword" with "Show all".
  The chart stays inside the Keywords disclosure (decision 6).
- Keywords still come from server results that exist only after the reveal;
  nothing changes in what the server sends.

## Trade-offs

A row layout is less compact than a packed circle layout, but it needs no
collision solver and keeps a predictable keyboard and reading order.

## Verification

Unit tests cover area ratios, uniform shrinking and the empty case. The
production build passed and `APP_URL=http://127.0.0.1:8083 pnpm check` passed
58 tests in 11 files with zero Svelte errors or warnings. In headless Chrome,
six seeded answers produced diameters of 88, 62.2 and 44px for counts 4, 2
and 1 (area 4:2:1). Selecting #time showed 4 of 6 answers, with no horizontal
overflow at 1280px or 390px. Both screenshots rendered in the dark theme; the
light theme was not checked separately. Screenshots:
[desktop](../../docs/design/keyword-bubbles-desktop.jpg),
[phone](../../docs/design/keyword-bubbles-mobile.jpg).
