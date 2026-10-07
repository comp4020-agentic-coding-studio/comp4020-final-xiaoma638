# Process overview

Crit 8, 7 October 2026. I used an AI agent to help draft this account from the project records and our discussion.

## My idea

Silent Review Wall is a tool for group feedback. A host creates a review space and shares a link or code. People join and answer a question on their own. They can only see other answers after the deadline. The group can then discuss the results. I want this quiet first step to help people form their own ideas. I still need to test this with classmates.

I kept the first version small. Each space has one active question, with either a single-choice or written answer. People can return to the same space and read past results. The app uses a browser cookie instead of an account. This makes joining easier, but changing browsers or clearing cookies can create a new identity. Results hide names from other participants, but the server still knows who wrote each answer. [ADR 4](doc/adr/0004-identity-and-access.md) explains this choice.

## Rules and tests

I used [CLAUDE.md](CLAUDE.md) to give agents clear rules. The main rules are simple: keep answers private before reveal, use server time for deadlines, and allow one answer per identity. The app should only say “Saved” after the server accepts the answer. These rules guide both the code and the tests.

Privacy must work on the server. Hiding answers on the screen is not enough if people can still find them in the data sent to their browser. The [privacy tests](spec/isolation.test.ts) check this. The database stores the deadline, and the server checks it before accepting an answer. A late timer must not give someone extra time. [Deadline tests](spec/deadline.test.ts) check the boundary. [Response tests](spec/responses.test.ts) check repeated requests and conflicting edits. The rules and implementation are in [d6d2e06](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xiaoma638/commit/d6d2e06).

## Choosing the tools

The app uses SvelteKit and TypeScript for both the pages and server code. This keeps the project in one place. The Node adapter runs the server and supports live connections. SQLite stores the data in a file, which fits the course setup of one machine and one storage volume. Drizzle helps define the database tables and record changes to them.

A separate API or database server would make this version harder to run. The current setup is simpler, but it is built for one app process. It would need changes to run across several machines. SQLite also needs a native package during the build. [ADR 1](doc/adr/0001-stack.md) records these choices and costs.

For live updates, the app uses Server-Sent Events (SSE). The server sends a version number when data changes. Each browser then requests the latest data it is allowed to see. This keeps private answers out of the shared event messages. It adds an extra request for each update. Old responses cannot replace newer data, and reconnecting loads the current state. WebSockets were not needed because normal HTTP requests already handle submissions. [ADR 2](doc/adr/0002-live-updates.md) explains this design. The target of twenty people at once still needs testing.

## Working with agents

I asked agents to inspect the project and improve the design. The first pass made the layout better, but the interface still had too much text. I asked for a simpler and clearer page. The next pass removed sample text and long explanations. Join and Host stayed in one panel. Optional help moved into sections that users can open. Errors, unsaved changes and the deadline stayed visible. [ADR 6](doc/adr/0006-reduce-interface-copy.md) records my feedback and the changes.

I then asked several agents to discuss the experience. One reviewed the appearance, one reviewed the user flow, and one reviewed small interactions. They shared feedback and edited separate files. A main agent combined the work and checked it in the browser.

This helped cover more problems, but the results still needed checking. Browser tests found that liking an answer could lose keyboard focus when the answers changed order. They also found a message that wrongly said the draft question was hidden. Both were fixed. [ADR 8](doc/adr/0008-coordinated-experience-polish.md) records the work, with [desktop](docs/design/polished-home-desktop.jpg) and [phone](docs/design/polished-home-mobile.jpg) screenshots.

## Fixing Host creation

I reported that Host creation did not work. The server created the space, but the next page could not find the user's identity. The local server treated the connection as HTTPS, while the browser used HTTP. This set the cookie's Secure flag, which caused problems in some browsers. The test client did not follow browser cookie rules, so the existing tests missed this.

The agent added a local preview command that tells the server to use HTTP. HTTPS keeps its Secure cookie setting. The first attempted fix used a setting that the installed adapter no longer supported. Checking the actual version and rerunning the test caught this mistake. A new [identity test](spec/identity.test.ts) checks the cookie settings, and CLAUDE.md now includes this rule. [ADR 7](doc/adr/0007-local-preview-protocol.md) records the fix in [d6d2e06](https://github.com/comp4020-agentic-coding-studio/comp4020-final-xiaoma638/commit/d6d2e06).

Another fix protected unsaved answers. A save response must not replace newer text typed by the user. Unsaved text also stays available when results appear. This only lasts for the current page visit, not after a reload. [Draft tests](spec/unit/response-draft.test.ts) cover the save behaviour.

## Checks and next steps

The latest code check passed all 55 tests in 11 files, with no Svelte errors or warnings. The production build also passed. Browser checks used two identities to join, answer, view results, like answers and read history. Layout checks used desktop and phone sizes of 1920×1080 and 390×844. These were developer checks, not classmate testing or a full accessibility review.

I still need to verify the app and saved data on Fly, finish the README argument and sources, and ask classmates to use the app without help. The code changes are currently in one large commit. The decision records explain the work, but smaller commits would show the process more clearly. I plan to commit future fixes separately.
