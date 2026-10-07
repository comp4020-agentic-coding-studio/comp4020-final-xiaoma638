import { describe, expect, it } from "vitest";
import { Client, join, newOrg, sleep, startQuestion, waitPast } from "./helpers.ts";

// The server's clock decides: accepted strictly before the deadline, refused
// at or after it, and revealed on time with nobody watching.

describe("deadline", () => {
  it("accepts just before and refuses after, then reveals with no client connected", async () => {
    const host = new Client();
    const alice = new Client();
    const bob = new Client();
    const { orgId, code } = await newOrg(host);
    await join(alice, code);
    await join(bob, code);
    const { questionId, deadline } = await startQuestion(host, orgId, { kind: "open" }, 5);

    await sleep(Math.max(0, deadline - Date.now() - 1000));
    const early = await alice.req("PUT", `/api/questions/${questionId}/response`, { text: "on time", baseVersion: 0 });
    expect(early.status).toBe(200);

    await waitPast(deadline, 50);
    const late = await bob.req("PUT", `/api/questions/${questionId}/response`, { text: "too late", baseVersion: 0 });
    expect(late.status).toBe(409);
    expect(late.body.error).toBe("deadline_passed");

    // the reveal timer ran with no reader involved: check the stored state via the host
    await sleep(300);
    const snap = await host.req("GET", `/api/orgs/${orgId}/snapshot`);
    expect(snap.body.current.phase).toBe("REVEALED");
    expect(snap.body.current.revealedAt).toBe(deadline);
    expect(snap.body.current.results.responses.map((r: { text: string }) => r.text)).toEqual(["on time"]);
  });

  it("never lets a burst of submissions around the deadline slip in late", async () => {
    const host = new Client();
    const { orgId, code } = await newOrg(host);
    const members = Array.from({ length: 8 }, () => new Client());
    for (const m of members) await join(m, code);
    const { questionId, deadline } = await startQuestion(host, orgId, { kind: "open" }, 5);

    await sleep(Math.max(0, deadline - Date.now() - 40));
    const results = await Promise.all(
      members.map(async (m, i) => {
        await sleep(i * 10);
        const sentAt = Date.now();
        const res = await m.req("PUT", `/api/questions/${questionId}/response`, { text: `burst ${i}`, baseVersion: 0 });
        return { status: res.status, sentAt };
      }),
    );
    for (const r of results) expect([200, 409]).toContain(r.status);

    await waitPast(deadline);
    const snap = await host.req("GET", `/api/orgs/${orgId}/snapshot`);
    const accepted = results.filter((r) => r.status === 200).length;
    // what the server accepted is exactly what's counted: no late write landed after a refusal or the reveal
    expect(snap.body.current.results.total).toBe(accepted);
    expect(snap.body.current.submittedCount).toBe(accepted);
  });

  it("locks the question once collection starts", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    const { questionId } = await startQuestion(host, orgId, { kind: "open" }, 30);
    const edit = await host.req("PUT", `/api/questions/${questionId}`, { kind: "open", prompt: "changed", durationSec: 30 });
    expect(edit.status).toBe(409);
    const again = await host.req("POST", `/api/questions/${questionId}/start`, {});
    expect(again.status).toBe(409);
  });

  it("allows only one open question per organization", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    await startQuestion(host, orgId, { kind: "open" }, 30);
    const second = await host.req("POST", `/api/orgs/${orgId}/questions`, { kind: "open", prompt: "two", durationSec: 30 });
    expect(second.status).toBe(409);
  });
});
