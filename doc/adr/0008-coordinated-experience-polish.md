# 8. Improve visual hierarchy, flow and interaction together

Status: accepted (2026-10-07)

Builds on decisions 5–7 while preserving the owner's request for a concise
interface. The owner explicitly requested several agents to discuss improvements
at multiple levels, with both usability and appearance as outcomes.

## Review and decisions

Three agents independently reviewed visual design, user journeys and interaction
details, then exchanged critiques before editing separate files. The primary
agent coordinated the implementation and performed browser verification.

- **Visual hierarchy:** screenshots showed that the unselected Host control
  looked disabled in the dark theme. Use a visible accent border and background
  for selected modes, readable unselected text, and small supporting line icons.
  Distinguish page, card and input surfaces. Keep the warm light theme and make
  the dark palette a clearer neutral charcoal. Refine the paper-note illustration
  without adding marketing copy.
- **Flow:** keep a single room column. Match history detail to its 52rem width,
  remove the duplicate question-type label, and give error pages one clear way
  back. Copying an invite link replaces the old code-only copy action; the code
  remains visible and selectable. The link fills the join form but never joins
  automatically.
- **Interaction:** compare the current answer with confirmed server content for
  save feedback. Reverting an edit restores Saved and disables a redundant
  update; obsolete errors no longer contradict confirmed content. Keep the
  existing dirty/version guards that protect new edits during requests. Group
  question-type radios natively and focus the new or adjacent option when
  options are added or removed.
- **Results:** replace masonry columns with a row-ordered grid, two columns on
  desktop and one on phones. Keep stable answer keys and colours; use softer
  tints and a consistent corner radius. Match sort-control selection styling
  to the entry and question-type controls. With one answer, use the available
  width and omit sorting controls. Browser testing exposed focus loss during
  pending likes and DOM reordering: use a guarded accessible busy state and
  restore the focused result after reordering without overriding a user who
  has moved to another control.

Browser review also caught misleading draft guidance: participants can already
see the draft question, although answers remain private. Change “Hidden from
participants” to “Review hasn't started”, without changing server visibility
rules. While editing a draft, show “Edit question” above the editor instead of
repeating the entire question.

## Trade-offs

The grid trades tightly packed masonry for predictable visual and keyboard
reading order. An invite link is longer than the code but avoids manual entry;
manual code entry remains available. Secondary explanations remain in native
disclosures rather than adding more persistent instructions or a sidebar.

## Verification

The production build succeeded. `APP_URL=http://127.0.0.1:8082 pnpm check`
passed 55 tests in 11 files, with zero Svelte errors or warnings. The new invite
test verifies server-rendered prefill, no identity or membership from merely
opening a link, and member-only access after explicit joining.

Browser checks at 1920×1080 and 390×844 found no horizontal overflow on the
home page. The mobile primary action ended around 575px, within the initial
viewport. Two browser identities exercised invitation prefill and joining,
live collection, submission, and editing/reverting a saved answer. Native
arrow keys changed question type; adding an option focused the new field and
removing it focused the adjacent field.

Automatic reveal, liking/unliking and live ranking were also checked. In both
ranking directions, the original like button retained keyboard focus after the
fix. The result grid was inspected in light mode at 1280px and dark mode at
390px, with a single mobile column and no horizontal overflow. History retained
its read-only likes, omitted the irrelevant sort switch for one answer, and
matched the room layout. The 404 recovery action returned to the join form.

Token contrast calculations covered ink, secondary and muted text on page,
card and input backgrounds in both themes; the lowest tested normal-text
pair was 4.91:1. Placeholder opacity was corrected to retain 5.08:1 in the
light theme. These numerical checks are not a claim of a complete accessibility
audit or independent peer testing.

Screenshots: [desktop entry](../../docs/design/polished-home-desktop.jpg),
[phone entry](../../docs/design/polished-home-mobile.jpg),
[light results](../../docs/design/polished-results-light.jpg),
[phone results](../../docs/design/polished-results-mobile.jpg),
[phone history](../../docs/design/polished-history-mobile.jpg).
