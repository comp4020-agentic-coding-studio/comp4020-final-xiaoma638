# Silent Review Wall Project Rules

This file guides developers and AI agents working on Silent Review Wall and defines the rules that acceptance tests must enforce. Participants respond independently without seeing other people's answers. At the deadline, the application reveals the results so the group can choose what to discuss.

## Project Goals and Initial Scope

- A host creates an organization, which is a shared review space, and shares its join code. Participants join and answer choice questions or open-ended questions. Results are revealed automatically when time expires.
- Choice questions display vote charts. Open-ended questions display responses and a ranking by likes. The keyword bubble chart is an enhancement to add after the core response and reveal flow works.
- Initially, each organization runs only one question at a time. Choice questions are single-choice. Result cards do not display authors' nicknames. Keywords initially come from tags supplied by participants.
- Good means that other people's answers remain hidden until the reveal, everyone understands the current phase, result counts can be checked, and participants can continue after a disconnection or server restart. Invite classmates to try the application and record whether they can complete the flow without an explanation.

Keep the product goals and their rationale in `README.md`. This file holds enduring implementation rules, while `spec/` verifies promises that can be checked automatically. If these initial choices change, update the rules, tests, and decision records together.

## Identity and Organization Permissions

- A user may create their own organization or join someone else's. The creator automatically becomes that organization's host. A join code grants membership, not host privileges.
- The server assigns a random identity. The browser uses a persistent, unguessable credential to recover that identity. Nicknames are display names only. Validate membership and host privileges on the server.
- Match identity-cookie security to the actual browser-facing protocol. Use `pnpm preview` for local HTTP production-build checks; its loopback listener supplies the HTTP protocol before adapter-node handles requests. Keep the trusted HTTPS proxy configuration for deployment. Verify first-time creation and joining without relying on a previously saved identity, and assert cookie attributes because the HTTP test client does not enforce browser cookie policy. adapter-node 6 no longer reads the runtime `ORIGIN` variable; consult the installed version before configuring it.
- Hosts can create questions, start collection, close discussions, and answer under the same response rules as other participants. Reading existing organization content, acting on questions, and subscribing to updates require membership checks. Creating an organization and joining with a valid code are entry-point exceptions. Object IDs must not enable access across organizations.
- The initial version counts browser identities. Clearing credentials or switching browsers may create a new identity; explain this limitation in the interface. Hiding nicknames after the reveal does not mean that the system cannot identify authors.

## Question Phases and Transitions

| Phase | Permitted actions | Transition |
| --- | --- | --- |
| `DRAFT` | The host edits the question, options, and duration. Members may join. | Starting collection fixes the deadline. |
| `COLLECTING` | Members submit or edit their own responses. Only the total submission count is shared. | The server reveals results automatically at the deadline. |
| `REVEALED` | Responses are frozen. Members view charts and keywords and may like open-ended responses. | The host closes the discussion. |
| `CLOSED` | Results and likes are read-only and retained in the history. | This question stays closed. The host may start a separate draft question. |

## Response Rules

### Deadlines and Submission Consistency

- Lock the question text, options, and deadline when collection starts. Persist the deadline and enforce it on the server; the client only displays the countdown. The initial version does not support early reveals or reopening questions.
- When saving a response, atomically validate identity, phase, and server time. Accept the write only when the server's decision time is strictly before the deadline. Reject it at or after the deadline. The client's click time is not authoritative.
- Allow one response per identity per question, enforced by a database uniqueness constraint. Updates must include the response version they are based on. The server validates that version and increments it on success. Reject stale updates, preserve the user's input, and explain the conflict.
- A single-choice response must reference a valid option belonging to that question. Reject blank open-ended responses and enforce a length limit. Apply consistent client and server validation, preserving input when validation fails.

### Visibility During Silent Collection

- Before the reveal, hosts and participants may read only their own response and the total submission count. Do not expose other people's answers, keywords, author associations, or answer statistics.
- Enforce this isolation in HTML, preloaded data, APIs, SSE, caches, and logs. Never send hidden answers to the browser and rely on frontend styling to conceal them.
- Display a successful submission only after the server confirms that it has been saved. Preserve input during network failures and allow retries. Reject offline requests that arrive after the deadline and clearly show the failure.
- A save acknowledgement must not overwrite changes typed while the request was in flight. Distinguish the saved answer from later unsaved edits. Keep unsaved drafts available to copy through reveal and host closure for the current page visit; never imply those drafts were counted.

### Late Arrivals and Recovery

- Allow participants to join during an activity. They may answer before the deadline. After the reveal, they may view results and, while the discussion remains open, like responses. They may not submit a late answer to the current question.
- The host leaving must not prevent the reveal. On startup and before reads or writes, reconcile the phase with the deadline: an expired `COLLECTING` question becomes `REVEALED`, while a `CLOSED` question stays closed. A delayed background task must not extend the response window.

## Result Presentation and Counting

### Choice Question Charts

- Use a labeled bar chart by default. Each valid response contributes one vote. Calculate percentages using the number of valid responses as the denominator, and display that total. Exclude nonrespondents from the denominator.
- When there are no responses, show an empty state such as "No responses yet." Counts and percentages must be independently checkable. Explain that rounding may cause percentages not to total exactly 100%.

### Open-Ended Responses and Likes

- Freeze the original responses after the reveal. Do not display authors' nicknames on result cards. Each identity may like each other person's response at most once and may remove its own like. Participants may like multiple responses but cannot like their own.
- Like and unlike requests must specify the intended state. Retrying a request must not toggle the state repeatedly or duplicate the count. Freeze likes when the discussion closes.
- Offer both original order and ordering by likes. Initially display responses in first-submission order. For the ranking, sort by like count descending, first-submission time ascending, and then response ID, consistently across clients. Preserve reading position and keyboard focus when updating the ranking.

### Keyword Bubble Chart

- Initially, participants may optionally supply up to three keywords with an open-ended response. Trim surrounding whitespace, normalize English letter case, and count a repeated keyword only once within the same response.
- A keyword's frequency is the number of responses containing that keyword. It is not a like count or an automatically inferred theme. Make bubble area proportional to frequency and provide a text frequency list alongside the chart so the values can be checked.
- Freeze keywords with their responses at the deadline and hide them until the reveal. Show an empty state when no keywords exist. Prevent overlapping labels and ensure small bubbles remain usable interaction targets.

## Technology Conventions

Use SvelteKit and TypeScript for the frontend and backend, with `adapter-node` producing the deployment server. Use SQLite for storage, Drizzle for the schema and migrations, and SSE to notify clients of changes. Record the reasons for these choices, alternatives considered, and actual dependency versions in `doc/adr/` and the project configuration.

- Separate pages, business rules, database access, and real-time notifications. Centralize state transitions, permissions, and counting rules on the server, with pages using the same interfaces.
- Follow the course deployment constraint of one Fly machine and one persistent volume. Put the database file at the actual mounted path. Verify deployment, restarts, and upgrades early. Production data must not depend on process memory or temporary directories.
- Make schema changes through new migration files committed with the corresponding code. Run migrations at application startup on the machine with the mounted volume. Do not solve compatibility issues by clearing data or modifying migrations that have already been applied.

## Data and Real-Time Synchronization

- Persist organizations, identities, memberships, host privileges, questions, phases, deadlines, responses, tags, and likes. The database is authoritative; real-time connections and in-memory caches must be rebuildable.
- Database constraints must enforce at most one response per identity per question, at most one like per identity per response, and valid question and organization relationships. Use transactions to produce consistent outcomes when submissions, reveals, closing, and likes conflict.
- Send SSE notifications only after the database transaction commits. During collection, broadcast only progress and phase changes that do not reveal answers. After the reveal, distribute result changes according to permissions.
- Fetch an authoritative snapshot when a connection is established or re-established and when an update notification arrives. Include the phase and a monotonically increasing version in snapshots. Older snapshots must not overwrite newer state. Implement heartbeats, disconnection cleanup, and retries.
- With normal connectivity and an available service, relevant changes should appear in other open sessions within about one second. Validate the initial version with twenty concurrent participant identities. Record measured results rather than presenting this target as an already-passed test.

## Interface and Interaction Conventions

- Keep each screen focused on its current task. Avoid repeating phase guidance, privacy explanations or save confirmations in multiple places. Put optional help, keyword tools and counting details behind labeled, keyboard-accessible disclosures; keep the question, primary action, deadline and important feedback visible.
- Make selected controls visibly distinct without making unselected choices look disabled. Keep normal text and placeholders readable in both themes. Use native radio grouping and move focus predictably when dynamic form fields are added or removed.
- A shared invite may prefill the join code, but must not join automatically or grant host rights. Saved feedback must reflect equality with the confirmed server answer, including when the user reverts their edits; suppress obsolete failure messages once that content is confirmed. Keep the separate dirty guard that protects edits while requests are in flight.
- Clearly display the current question, phase, deadline or reveal status, and available actions. During collection, show progress as "X responses submitted" rather than conflating online users with respondents.
- Display connection loss and synchronize automatically after recovery. Give clear success, failure, and conflict feedback for important actions so users do not mistakenly believe a response has been saved.
- Only show an up-to-date connection after the authoritative snapshot has caught up. Retry failed snapshot requests even while SSE remains open, and release listeners, requests and timers when the page is left. Own the connection in the component mount lifecycle, not an effect that tracks incoming snapshots.
- Phase guidance must match the question type. Draft editing has a cancel path; joining and hosting must both be readily reachable on a phone. Counts label submitted responses separately from membership.
- Support the same core flow on desktop and mobile, including keyboard operation, visible focus, and form labels. Supplement colors and bubble sizes with text that explains their meaning.
- Render question text, nicknames, responses, and tags as plain text. Do not execute user-provided HTML or scripts.
- Keep previous questions accessible in the history. Creating a new question must not overwrite earlier records. Only organization members may access results. Join codes must not appear in public logs.

## Logging and Observability

- Write structured logs for joining, starting collection, submitting, editing, revealing, liking, and closing. Include the timestamp, event type, organization and question IDs, internal participant ID, request ID, outcome, and relevant timing information.
- Do not log credentials, join codes, response bodies, selected options, or raw keywords. Developers use the deployment platform's live logs to explain activity. Do not expose logs as pages or APIs available to ordinary members.
- Record reveal events and their timestamps. State recovery and task retries must not create duplicate business changes. Use logs and database records to investigate user reports without presenting unverified assumptions as facts.

## Verification and Acceptance Checklist

Inspect the actual repository scripts first, then document the development, build, and test commands in `README.md`. Preserve the course's `pnpm check` and `pnpm check:evidence` entry points and integrate new business checks into the existing workflow. Do not assume that commands exist or claim that tests have passed without running them.

| Scenario | Expected result |
| --- | --- |
| Identity and permissions | Independent browsers receive distinct identities; refreshes preserve identity; join codes do not grant host privileges; cross-organization reads, writes, and subscriptions are rejected. |
| Isolation before reveal | Check HTML, APIs, preloaded data, and SSE as both a host and an ordinary member. Neither can obtain other people's responses or result distributions. |
| Deadline boundaries | Test just before, exactly at, and after the deadline. Simulate slow requests and simultaneous saving and revealing. No expired submission is accepted. |
| Response uniqueness | Retries and concurrent edits from multiple tabs do not create multiple responses. Stale versions receive explicit conflict feedback. |
| Automatic reveal and recovery | Results are revealed even when the host is offline. Restarts preserve the deadline. Expired `COLLECTING` questions recover as `REVEALED`; `CLOSED` questions stay closed. |
| Correct statistics | Use known fixtures to verify votes, percentages, tag deduplication, and bubble frequencies. Cover zero responses, repeated tags, and missing keywords. |
| Consistent likes | Retries do not duplicate counts; self-likes are rejected; unliking affects only the caller's like; ties sort consistently; closed discussions reject likes and unlikes. |
| Real-time updates and disconnections | Use two independent browsers to verify progress, reveal, and like updates. Reconnection restores state without a manual refresh. Old snapshots do not overwrite newer state. |
| Persistence and migrations | Restart and redeploy with saved test data. Organizations, responses, likes, and permissions survive. Migrations preserve existing data. |
| Interface and usability | Check 1920×1080 and 390×844 viewports, keyboard use, long text, special characters, and network failures. Invite classmates to complete a review independently. |
| Course checks and logs | The homepage and `/readme/` are accessible; course checks pass; logs explain actions without exposing answers or credentials. |

## Working Process and Delivery

- Keep each change focused on a clear goal. Reproduce defects before fixing them and add appropriate regression tests for permissions, deadlines, counting, concurrency, and recovery. Do not conceal defects by weakening assertions.
- Before starting work, read `README.md`, `spec/README.md`, and the relevant code. Record important trade-offs in `doc/adr/`. When changing an accepted decision, create a superseding record and update this file and the tests.
- After completing work, report what changed, which checks actually ran, their results, and anything still unverified. Build the commit history as the work progresses. Cite concrete evidence for real user feedback and important decisions in `PROCESS.md`.
- Deliver the live application, source and checks, the full `README.md` published at `/readme/`, this `CLAUDE.md`, `PROCESS.md`, and the three crit reflections. Update these rules with enduring lessons and keep detailed development accounts in `PROCESS.md`.

## Course References

- [ANU COMP4020 Final Project requirements](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
- [ANU Assessment environment and process evidence](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/)
