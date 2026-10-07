import { describe, expect, it } from "vitest";
import { Client, join, newOrg, startQuestion } from "./helpers.ts";

// One response per identity per question, with versioned edits.

describe("responses", () => {
  it("keeps one response per identity under concurrent first submissions", async () => {
    const host = new Client();
    const alice = new Client();
    const { orgId, code } = await newOrg(host);
    await join(alice, code);
    const { questionId } = await startQuestion(host, orgId, { kind: "open" }, 30);

    const replies = await Promise.all(
      ["tab 1", "tab 2", "tab 3", "tab 4"].map((text) =>
        alice.req("PUT", `/api/questions/${questionId}/response`, { text, baseVersion: 0 }),
      ),
    );
    expect(replies.filter((r) => r.status === 200)).toHaveLength(1);
    for (const r of replies.filter((r) => r.status !== 200)) {
      expect(r.status).toBe(409);
      expect(r.body.error).toBe("stale_version");
    }
    const snap = await host.req("GET", `/api/orgs/${orgId}/snapshot`);
    expect(snap.body.current.submittedCount).toBe(1);
  });

  it("treats a retry of a saved answer as success, not a duplicate", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    const { questionId } = await startQuestion(host, orgId, { kind: "open" }, 30);
    const body = { text: "same", tags: ["A", "b"], baseVersion: 0 };
    const first = await host.req("PUT", `/api/questions/${questionId}/response`, body);
    const retry = await host.req("PUT", `/api/questions/${questionId}/response`, body);
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(retry.body.version).toBe(1);
  });

  it("increments the version on edit and refuses a stale one, returning the saved answer", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    const { questionId } = await startQuestion(host, orgId, { kind: "open" }, 30);
    const v1 = await host.req("PUT", `/api/questions/${questionId}/response`, { text: "first", baseVersion: 0 });
    const v2 = await host.req("PUT", `/api/questions/${questionId}/response`, { text: "second", baseVersion: 1 });
    expect(v2.body.version).toBe(2);
    const stale = await host.req("PUT", `/api/questions/${questionId}/response`, { text: "third", baseVersion: v1.body.version });
    expect(stale.status).toBe(409);
    expect(stale.body.current.text).toBe("second");
  });

  it("validates bodies the same way the form does", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    const open = await startQuestion(host, orgId, { kind: "open" }, 30);
    const put = (body: unknown) => host.req("PUT", `/api/questions/${open.questionId}/response`, body);
    expect((await put({ text: "   ", baseVersion: 0 })).status).toBe(400);
    expect((await put({ text: "x".repeat(501), baseVersion: 0 })).status).toBe(400);
    expect((await put({ text: "ok", tags: ["a", "b", "c", "d"], baseVersion: 0 })).status).toBe(400);
    expect((await put({ text: "ok" })).status).toBe(400);
  });

  it("refuses an option from another question", async () => {
    const hostA = new Client();
    const a = await newOrg(hostA);
    const qa = await startQuestion(hostA, a.orgId, { kind: "choice", options: ["x", "y"] }, 30);
    const hostB = new Client();
    const b = await newOrg(hostB);
    const qb = await startQuestion(hostB, b.orgId, { kind: "choice", options: ["p", "q"] }, 30);
    const res = await hostA.req("PUT", `/api/questions/${qa.questionId}/response`, {
      optionId: qb.options[0].id,
      baseVersion: 0,
    });
    expect(res.status).toBe(400);
  });

  it("renders user text as text, not markup", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    await host.req("POST", `/api/orgs/${orgId}/questions`, {
      kind: "open",
      prompt: "<script>alert(1)</script>",
      durationSec: 30,
    });
    const page = await host.html(`/o/${orgId}`);
    expect(page.text).not.toContain("<script>alert(1)</script>");
    expect(page.text).toContain("&lt;script>alert(1)&lt;/script>");
  });
});
