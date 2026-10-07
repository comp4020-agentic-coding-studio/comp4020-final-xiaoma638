import { describe, expect, it } from "vitest";
import { Client, join, newOrg, openEvents, startQuestion, waitPast } from "./helpers.ts";

// Changes reach other open sessions within about a second, as a version
// bump that the client follows with a snapshot fetch.

describe("live updates", () => {
  it("notifies another session of a submission and of the reveal", async () => {
    const host = new Client();
    const alice = new Client();
    const { orgId, code } = await newOrg(host);
    await join(alice, code);
    const { questionId, deadline } = await startQuestion(host, orgId, { kind: "open" }, 5);

    const before = (await host.req("GET", `/api/orgs/${orgId}/snapshot`)).body.version;
    const events = await openEvents(host, orgId);
    expect(await events.waitFor(new RegExp(`"version":${before}\\b`), 1000)).toBe(true);

    const sent = Date.now();
    await alice.req("PUT", `/api/questions/${questionId}/response`, { text: "hi", baseVersion: 0 });
    expect(await events.waitFor(new RegExp(`"version":${before + 1}\\b`), 1000)).toBe(true);
    expect(Date.now() - sent).toBeLessThan(1000);

    await waitPast(deadline, 0);
    expect(await events.waitFor(new RegExp(`"version":${before + 2}\\b`), 1500)).toBe(true);
    events.close();

    const snap = (await host.req("GET", `/api/orgs/${orgId}/snapshot`)).body;
    expect(snap.version).toBe(before + 2);
    expect(snap.current.phase).toBe("REVEALED");
  });

  it("carries only version numbers, never content", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    const events = await openEvents(host, orgId);
    await events.waitFor(/event: change/, 1000);
    events.close();
    for (const line of events.text.split("\n").filter((l) => l.startsWith("data:"))) {
      expect(Object.keys(JSON.parse(line.slice(5)))).toEqual(["version"]);
    }
  });
});
