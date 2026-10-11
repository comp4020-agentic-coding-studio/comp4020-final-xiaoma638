# Crit 9 — All at once

## What was the breakthrough that moved the work forward?

The breakthrough was deciding what other people should see while everyone answers. The app was already real-time, so the hard question was not how updates travel but how much they should say. I chose to share only the number of submitted answers. Showing who is online or who is still typing would bring back the pressure the app is meant to remove. Writing [ADR 13](../doc/adr/0013-what-others-see-before-reveal.md) made me name what this costs, such as a host not knowing who is stuck.

The second moment came when I changed a core rule and allowed a queue of questions. Testing the database change on a copy with real data showed it would have stopped the app from starting on Fly. Passing tests on a fresh database were not enough.

## What did this work change about who I want to be as a software developer?

I want to be a developer who asks for one change at a time and checks it before moving on. When I asked for improvements in order, each check found a side effect, like lost keyboard focus or a like count breaking onto two lines. I also learned to ask "why" about limits before removing them. The one-question rule had a reason, so changing it meant updating the rules, tests and README together.
