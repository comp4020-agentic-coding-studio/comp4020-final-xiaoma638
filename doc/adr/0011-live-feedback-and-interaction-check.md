# 11. Make live activity visible, and check interactions in real browsers

Status: accepted (2026-10-10)

Builds on decision 10.

## Context

The owner asked to verify the new features and to make the review feel more
interactive. Earlier checks used single screenshots and left several things
unverified: live updates between browsers, the flip animation mid-motion,
keyboard use of the QR dialog, full screen and reduced motion.

## Decision

Every addition shows only information members already have:
- **Answer pile.** Each submitted answer adds one face-down card that drops in.
  The shared screen shows a large spread; the room shows a small overlapping
  row. The cards are identical, carry no order or author, and show only the
  submitted count.
- **Count bump.** The submitted count briefly scales up when it changes.
- **Likes.** The heart pops when liked, the count ticks, and supporting phones
  vibrate briefly.
- **Ranking moves.** Answers glide to their new places when the "Most liked"
  order changes (`animate:flip`). That animation runs through the Web
  Animations API, outside the global reduced-motion CSS, so the component sets
  its duration to 0 when reduced motion is requested.
- **Saved badge.** The confirmation pops in. It still appears only after the
  server confirms the answer.

`scripts/verify-interactions/` drives three headless Chrome windows, as the
shared screen, a phone participant and the host room, through one live review
with real clicks, typing and key presses. It is a developer check, not part of
`pnpm check`, because it needs Chrome and takes about a minute.

## Verification

`pnpm build` passed. `APP_URL=http://127.0.0.1:8083 pnpm check` passed 60
tests in 11 files with zero Svelte errors or warnings.
`node scripts/verify-interactions/verify.mjs` passed 25 of 25 checks:

- **Live updates.** The shared screen changed to Answering 30ms after start.
  Five submissions reached it in 28ms each. The phone's typed answer showed
  Saved and appeared on the shared screen.
- **Answer pile.** Five answers gave five face-down cards. Before the reveal,
  no answer text or keyword was anywhere in the shared screen's DOM.
- **Reveal.** The large 3-2-1 appeared in the final seconds. The shared screen
  revealed 25–53ms after the deadline without any action. Card opacity,
  sampled at 60, 260 and 520ms, showed the cards arriving one after another.
- **Likes and ranking.** A real click popped the heart and left "2 of 3 likes
  left". Three likes moved an answer from fourth to first on the shared
  screen. Followed frame by frame, the card passed through 26 positions with
  no step larger than 26px, so it glided rather than jumped. Two likes
  120ms apart also produced one continuous path.
- **Keyboard and display modes.** Enter opened the QR dialog with focus on
  Close, and Escape returned focus to the QR button. Space on a keyword
  bubble filtered the answers. Full screen toggled. With reduced motion
  requested, no card animation ran in the dark theme.
- **Layout.** No horizontal overflow on the shared screen at 1920×1080, the
  phone at 390×844 or the room at 1280×900.

The first run failed the ranking-animation check because it sampled running
animations at one moment. Tracing showed the animation did run. The check now
follows the card's position frame by frame instead.

Not verified:
- Scanning a projected QR code with a real phone camera.
- Vibration, since headless Chrome has no vibration hardware.
- Twenty simultaneous participants.
- Classmate testing.

Screenshots: [phone saved with pile](../../docs/design/live-03-phone-saved.jpg),
[shared screen pile](../../docs/design/live-04-present-six.jpg),
[flip mid-motion](../../docs/design/live-06-flip-260ms.jpg),
[ranking mid-move](../../docs/design/live-07-present-reorder-mid.jpg),
[keyword filter on phone](../../docs/design/live-09-phone-filtered.jpg).
