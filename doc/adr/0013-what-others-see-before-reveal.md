# 13. Before the reveal, show how many have answered, not who is here

Status: accepted (2026-10-11)

Records behaviour already built in ADRs 2 and 10 as a decision, for crit 9.

## Context

Several people are in a space at once, each answering alone. Something about
the others has to reach each person live, or nobody knows whether to keep
waiting. The question is how much.

README "what good means" item 1 is that nobody sees another answer before the
reveal. The reason behind it is that the first confident voice sets the
direction and quieter people adjust. That pressure doesn't need answer text.
Seeing *who* has finished, *who* is still typing, or *how fast* others answered
is enough to make someone rush, pad or second-guess. Item 4 still needs each
person to know the phase and whether the room is nearly done.

What a viewer sees live during collection today:

- the question, phase and countdown;
- "**N responses submitted**", with one face-down card per submission;
- the space's member count in the header (everyone who has joined, not who is
  online);
- their own answer and its saved state.

## Options

1. **Submission count only** (chosen). One anonymous number that only grows.
2. **Online count.** "8 here, 5 answered", from open SSE connections.
3. **Named presence.** Avatars or a list of who is in the room, as Miro, Google
   Docs or Slido's participant list show.
4. **Named progress.** Each person ticks when they submit, like a Kahoot lobby
   or a host-only "still waiting on Alex and Sam".
5. **Typing indicators.** "Someone is writing…", named or not.

## Decision

Option 1. The only live signal about other people before the reveal is the
number of saved answers. No online count, no names, no per-person status, no
typing signal, for the host as well as for members. The countdown, not the
room, decides when to stop, so nobody needs to know who is left.

Member count stays in the header because it changes only when someone joins,
says nothing about answering, and helps the host see that the invite worked.
It is never shown as a denominator ("5 of 12"): members include people who
joined last week and left, so the ratio would look like a lagging room.

## Why not the others

- **Online count (2)** is anonymous, but beside the submitted count it becomes
  "3 people haven't answered yet", which is pressure on exactly those people.
  It also flickers on phones that sleep, so it would often be wrong.
- **Named presence (3)** and **named progress (4)** single people out. In a
  group of ten, "still waiting on Sam" is the social pressure the app exists to
  remove. Named progress for the host only would make the host the person who
  knows, which item 1 rules out ("the host included").
- **Typing indicators (5)** leak timing. "Someone is still writing" invites
  people to make their own answer longer, and with a few people in a room an
  anonymous indicator is often not anonymous.

## Costs

- The host can't tell who is stuck or absent, so they can't nudge one person;
  they can only say "about a minute left" to everyone.
- A small group can't tell "everyone is done" from "three people left". With
  ten members and ten submissions people still wait for the countdown, because
  there is deliberately no early reveal (CLAUDE.md, ADR 10).
- Facilitators used to Kahoot or Slido may expect a participant list and read
  its absence as a missing feature.
- A late joiner can't see who else is here, only that answers are coming in.

## Revisit if

Classmate testing shows hosts regularly waiting on people who had already left,
or groups asking "is everyone here?" out loud. The least risky next step would
be a host-only, anonymous "connected now" count shown after the reveal, not
during collection.

## How it is checked

`spec/isolation.test.ts` and `spec/realtime.test.ts` check that before the
reveal the snapshot, HTML and SSE stream carry no other answer or author, and
that the stream carries only a version number. The interaction check
(`scripts/verify-interactions/verify.mjs`) confirms the shared screen shows the
count and face-down cards but no answer text before the reveal.
