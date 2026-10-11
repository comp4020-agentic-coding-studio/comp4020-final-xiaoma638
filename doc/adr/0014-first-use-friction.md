# 14. Cut first-use friction for participants and returning visitors

Status: accepted (2026-10-11)

Adjusts the room, answer form, results wall and home page. Other decisions remain in force.

## Context

The owner said the app "works, but feels average" to use. A walkthrough as a
new participant on a 390×844 phone and as a host on desktop found five
concrete problems. Slido and Kahoot put only the question and the input on a
participant's screen and confirm a submitted answer plainly. Padlet and
EasyRetro keep cards compact. Slido and Mentimeter put recent sessions first
and remember a participant's name.

## Decision

1. **Room header for members.** The join-code ticket (code, Copy link, QR)
   stays for the host. Members get one "Invite" button that opens the same QR
   dialog, which now also has "Copy invite link". On a phone the answer box and
   Submit button moved from below the fold into the first screen.
2. **Submitted state.** When the draft equals the server's saved answer, the
   disabled "Update answer" button is replaced by a green "Answer submitted /
   Vote submitted" panel that says the answer stays hidden and can be edited
   until the reveal. Any edit brings the button back with "Changed since you
   submitted"; reverting to the saved text shows the panel again. A keyboard
   submit moves focus to the panel, since the button it was on disappears.
   The equality rule, dirty guard, conflict panel and draft recovery are
   unchanged.
3. **Compact cards.** Keywords share the like row instead of taking their own
   line. A one-line tagged card on a phone went from about 136px to 106px; the
   44px like target is kept. Like counts never wrap.
4. **Returning visitors.** Without an invite in the URL, "Continue where you
   left off" lists the three most recent spaces above the join form, with the
   rest behind "Show N more". With an invite, the form leads and "Your spaces"
   stays below, because the visitor came to join something new.
5. **Nickname.** Arriving from an invite with no saved name focuses the
   nickname field. The nickname is kept in `localStorage` after a successful
   join or create and prefilled next time; with a saved name nothing is
   focused, so the phone keyboard doesn't cover Join. Joining still needs an
   explicit tap. Blocked storage falls back to an empty field.

## Consequences

- No schema, API, permission or isolation changes.
- A remembered nickname is per browser and only a display name, consistent
  with ADR 4; clearing site data forgets it.
- Members can still invite late joiners, one tap further away than before.
- Each change was checked in headless Chrome with scripted flows (scripts not
  committed) and the full `pnpm check` and `verify-interactions` suites.
