import { describe, expect, it } from "vitest";
import { Client, join, newOrg, openEvents, startQuestion, unique, waitPast } from "./helpers.ts";

// Before the reveal nobody, host included, can get anyone else's answer from
// the HTML, the API or the event stream. After it, everyone can.

describe("isolation before the reveal", () => {
  it("hides others' answers from host and members on every channel", async () => {
    const host = new Client();
    const alice = new Client();
    const bob = new Client();
    const { orgId, code } = await newOrg(host);
    await join(alice, code, "Alice");
    await join(bob, code, "Bob");

    const secret = unique("alice-secret");
    const secretTag = unique("tag").toLowerCase();
    const { questionId, deadline } = await startQuestion(host, orgId, { kind: "open" }, 6);

    const hostEvents = await openEvents(host, orgId);
    const saved = await alice.req("PUT", `/api/questions/${questionId}/response`, {
      text: secret,
      tags: [secretTag],
      baseVersion: 0,
    });
    expect(saved.status).toBe(200);
    await hostEvents.waitFor(/event: change[\s\S]*event: change/, 2000);

    for (const viewer of [host, bob]) {
      const snap = await viewer.req("GET", `/api/orgs/${orgId}/snapshot`);
      const detail = await viewer.req("GET", `/api/questions/${questionId}`);
      const page = await viewer.html(`/o/${orgId}`);
      for (const text of [JSON.stringify(snap.body), JSON.stringify(detail.body), page.text]) {
        expect(text).not.toContain(secret);
        expect(text).not.toContain(secretTag);
      }
      expect(snap.body.current.results).toBeNull();
      expect(snap.body.current.submittedCount).toBe(1);
      expect(snap.body.current.myResponse).toBeNull();
    }
    expect(hostEvents.text).not.toContain(secret);
    hostEvents.close();

    // the author sees their own answer
    const own = await alice.req("GET", `/api/orgs/${orgId}/snapshot`);
    expect(own.body.current.myResponse.text).toBe(secret);

    // and after the deadline everyone sees it, without the author's nickname
    await waitPast(deadline);
    const after = await bob.req("GET", `/api/orgs/${orgId}/snapshot`);
    expect(after.body.current.phase).toBe("REVEALED");
    expect(after.body.current.results.responses.map((r: { text: string }) => r.text)).toContain(secret);
    expect(JSON.stringify(after.body.current.results)).not.toContain("Alice");
  });

  it("hides choice statistics until the reveal", async () => {
    const host = new Client();
    const alice = new Client();
    const { orgId, code } = await newOrg(host);
    await join(alice, code);
    const { questionId, options } = await startQuestion(host, orgId, { kind: "choice", options: ["Yes", "No"] }, 30);
    await alice.req("PUT", `/api/questions/${questionId}/response`, { optionId: options[1].id, baseVersion: 0 });

    const snap = await host.req("GET", `/api/orgs/${orgId}/snapshot`);
    expect(snap.body.current.results).toBeNull();
    expect(JSON.stringify(snap.body)).not.toContain(`"count"`);
  });
});
