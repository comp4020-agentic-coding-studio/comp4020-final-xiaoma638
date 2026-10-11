import { describe, expect, it } from "vitest";
import { Client, join, newOrg, sleep, startQuestion, unique } from "./helpers.ts";

// ADR 15: drafts queue up behind the live question, members never see a draft,
// and an untimed question collects until the host reveals it.

const draft = (host: Client, orgId: string, durationSec = 30, prompt = unique("queued")) =>
  host.req("POST", `/api/orgs/${orgId}/questions`, { kind: "open", prompt, durationSec, options: [] });

describe("question queue", () => {
  it("queues any number of drafts, oldest first, while one question is live", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    await startQuestion(host, orgId, { kind: "open" }, 30);
    const prompts = [unique("q2"), unique("q3"), unique("q4")];
    for (const p of prompts) expect((await draft(host, orgId, 30, p)).status).toBe(201);
    const snap = (await host.req("GET", `/api/orgs/${orgId}/snapshot`)).body;
    expect(snap.current.phase).toBe("COLLECTING");
    expect(snap.queue.map((q: { prompt: string }) => q.prompt)).toEqual(prompts);
  });

  it("refuses to start a second question while one is live, then allows it after closing", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    const first = await startQuestion(host, orgId, { kind: "open" }, 5);
    const second = (await draft(host, orgId)).body.questionId;
    const early = await host.req("POST", `/api/questions/${second}/start`, {});
    expect(early.status).toBe(409);
    expect(early.body.error).toBe("question_live");
    await sleep(first.deadline - Date.now() + 300);
    // revealed but not closed is still live
    expect((await host.req("POST", `/api/questions/${second}/start`, {})).status).toBe(409);
    expect((await host.req("POST", `/api/questions/${first.questionId}/close`, {})).status).toBe(200);
    expect((await host.req("POST", `/api/questions/${second}/start`, {})).status).toBe(200);
  });

  it("starts exactly one of two drafts started at the same moment", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    const a = (await draft(host, orgId)).body.questionId;
    const b = (await draft(host, orgId)).body.questionId;
    const results = await Promise.all([a, b].map((id) => host.req("POST", `/api/questions/${id}/start`, {})));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("hides queued drafts from members on every channel", async () => {
    const host = new Client();
    const member = new Client();
    const { orgId, code } = await newOrg(host);
    await join(member, code);
    const secret = unique("secret-upcoming");
    const id = (await draft(host, orgId, 30, secret)).body.questionId;
    const snap = (await member.req("GET", `/api/orgs/${orgId}/snapshot`)).body;
    expect(snap.current).toBeNull();
    expect(snap.queue).toEqual([]);
    expect(JSON.stringify(snap)).not.toContain(secret);
    expect((await member.req("GET", `/api/questions/${id}`)).status).toBe(404);
    expect((await member.html(`/o/${orgId}/q/${id}`)).status).toBe(404);
    const room = await member.html(`/o/${orgId}`);
    expect(room.text).not.toContain(secret);
    const present = await member.html(`/o/${orgId}/present`);
    expect(present.text).not.toContain(secret);
    // the host still sees it
    expect((await host.req("GET", `/api/questions/${id}`)).body.prompt).toBe(secret);
  });

  it("lets only the host delete a draft, and never a started question", async () => {
    const host = new Client();
    const member = new Client();
    const { orgId, code } = await newOrg(host);
    await join(member, code);
    const id = (await draft(host, orgId)).body.questionId;
    expect((await member.req("DELETE", `/api/questions/${id}`, {})).status).toBe(403);
    expect((await host.req("DELETE", `/api/questions/${id}`, {})).status).toBe(200);
    expect((await host.req("GET", `/api/orgs/${orgId}/snapshot`)).body.queue).toEqual([]);
    const started = await startQuestion(host, orgId, { kind: "open" }, 30);
    const refused = await host.req("DELETE", `/api/questions/${started.questionId}`, {});
    expect(refused.status).toBe(409);
  });
});

describe("untimed questions", () => {
  async function untimed() {
    const host = new Client();
    const member = new Client();
    const { orgId, code } = await newOrg(host);
    await join(member, code);
    const id = (await draft(host, orgId, 0)).body.questionId;
    const started = await host.req("POST", `/api/questions/${id}/start`, {});
    return { host, member, orgId, id, started };
  }

  it("have no deadline and keep collecting until the host reveals", async () => {
    const { host, member, orgId, id, started } = await untimed();
    expect(started.status).toBe(200);
    expect(started.body.deadline).toBeNull();
    const saved = await member.req("PUT", `/api/questions/${id}/response`, { text: "in time", baseVersion: 0 });
    expect(saved.status).toBe(200);
    await sleep(1200);
    const snap = (await member.req("GET", `/api/orgs/${orgId}/snapshot`)).body;
    expect(snap.current.phase).toBe("COLLECTING");
    expect(snap.current.results).toBeNull();
    // still hidden from the host before the reveal
    expect(JSON.stringify((await host.req("GET", `/api/orgs/${orgId}/snapshot`)).body)).not.toContain("in time");
  });

  it("reveal only on the host's word, and refuse answers after it", async () => {
    const { host, member, orgId, id } = await untimed();
    await member.req("PUT", `/api/questions/${id}/response`, { text: "before", baseVersion: 0 });
    expect((await member.req("POST", `/api/questions/${id}/reveal`, {})).status).toBe(403);
    const revealed = await host.req("POST", `/api/questions/${id}/reveal`, {});
    expect(revealed.status).toBe(200);
    expect((await host.req("POST", `/api/questions/${id}/reveal`, {})).status).toBe(409);
    const late = await member.req("PUT", `/api/questions/${id}/response`, { text: "after", baseVersion: 1 });
    expect(late.status).toBe(409);
    const snap = (await member.req("GET", `/api/orgs/${orgId}/snapshot`)).body;
    expect(snap.current.phase).toBe("REVEALED");
    expect(snap.current.results.responses.map((r: { text: string }) => r.text)).toEqual(["before"]);
  });

  it("never lets the host cut a timed question short", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    const { questionId } = await startQuestion(host, orgId, { kind: "open" }, 30);
    const early = await host.req("POST", `/api/questions/${questionId}/reveal`, {});
    expect(early.status).toBe(409);
    expect(early.body.error).toBe("timed");
  });

  it("refuse a duration that is neither 0 nor in range", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    for (const durationSec of [1, -5, 3601, 2.5]) expect((await draft(host, orgId, durationSec)).status).toBe(400);
  });
});
