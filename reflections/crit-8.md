# Crit 8 — It's alive

## What was the breakthrough that moved the work forward?

The main breakthrough came from fixing Host creation. The server said it worked, but the next page could not find the user's identity. The problem was a cookie setting in the local preview. The test client handled cookies differently from a browser, so the tests had missed it.

The agent fixed the preview setup and added a test for the cookie settings. We also added the rule to CLAUDE.md. [ADR 7](../doc/adr/0007-local-preview-protocol.md) records the fix. This showed me that passing tests does not always mean the whole app works for a user.

## What did this work change about who I want to be as a software developer?

I want to be a developer who checks the result instead of only accepting the agent's answer. I asked the agents to reduce text and make the main action easy to find. Several agents reviewed the design, but their changes still needed browser checks.

I also learned that clear feedback matters. “Saved” should mean the answer is stored, and users should not lose unsaved text when results appear. Next, I need to test the app with classmates and check it on Fly.
