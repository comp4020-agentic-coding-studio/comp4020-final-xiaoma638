import { describe, expect, it } from "vitest";
import { Client, baseUrl, join, newOrg, startQuestion } from "./helpers.ts";

// Identity and organization permissions, against the running app.

describe("identity", () => {
  it("gives independent browsers distinct identities, and keeps one across requests", async () => {
    const a = new Client();
    const b = new Client();
    const { orgId, code } = await newOrg(a);
    await join(b, code);
    const sa = (await a.req("GET", `/api/orgs/${orgId}/snapshot`)).body;
    const sb = (await b.req("GET", `/api/orgs/${orgId}/snapshot`)).body;
    expect(sa.me.id).not.toBe(sb.me.id);
    expect((await a.req("GET", `/api/orgs/${orgId}/snapshot`)).body.me.id).toBe(sa.me.id);
  });

  it("sets a persistent credential with security attributes matching the public protocol", async () => {
    const a = new Client();
    const res = await a.raw("POST", "/api/orgs", { name: "x", nickname: "y" });
    const cookie = res.headers.getSetCookie().join("\n");
    expect(res.status).toBe(201);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=[1-9]\d*/i);
    // The test client stores cookies without browser transport restrictions.
    // Check this explicitly: an HTTPS-only cookie on a plain-HTTP preview can
    // otherwise make every API test pass while real browsers lose host access.
    expect(/;\s*Secure(?:;|$)/i.test(cookie)).toBe(new URL(baseUrl).protocol === "https:");
  });

  it("lets a new host open and reload their space with the issued credential", async () => {
    const host = new Client();
    const created = await host.req("POST", "/api/orgs", { name: "Host navigation check", nickname: "Host" });
    expect(created.status).toBe(201);
    const path = `/o/${created.body.orgId}`;

    const opened = await host.html(path);
    expect(opened.status).toBe(200);
    expect(opened.text).toContain("Host navigation check");
    const reloaded = await host.html(path);
    expect(reloaded.status).toBe(200);
    expect(reloaded.text).toContain("Host navigation check");

    const snapshot = await host.req("GET", `/api/orgs/${created.body.orgId}/snapshot`);
    expect(snapshot.status).toBe(200);
    expect(snapshot.body.me.isHost).toBe(true);
  });
});

describe("permissions", () => {
  it("makes the creator host and a joiner a member, never a host", async () => {
    const host = new Client();
    const member = new Client();
    const { orgId, code } = await newOrg(host);
    await join(member, code);
    await join(member, code); // joining again changes nothing about the role
    expect((await host.req("GET", `/api/orgs/${orgId}/snapshot`)).body.me.isHost).toBe(true);
    expect((await member.req("GET", `/api/orgs/${orgId}/snapshot`)).body.me.isHost).toBe(false);

    const drafted = await member.req("POST", `/api/orgs/${orgId}/questions`, {
      kind: "open",
      prompt: "member tries",
      durationSec: 30,
    });
    expect(drafted.status).toBe(403);
  });

  it("refuses an unknown join code", async () => {
    const res = await new Client().req("POST", "/api/join", { code: "ZZZZZZ0", nickname: "n" });
    expect(res.status).toBe(404);
  });

  it("refuses outsiders reading, writing or subscribing, even with the ids", async () => {
    const host = new Client();
    const outsider = new Client();
    const { orgId, code } = await newOrg(host);
    await newOrg(outsider); // the outsider has an identity, just not in this org
    const { questionId } = await startQuestion(host, orgId, { kind: "open" }, 30);

    expect((await outsider.req("GET", `/api/orgs/${orgId}/snapshot`)).status).toBe(404);
    expect((await outsider.req("GET", `/api/questions/${questionId}`)).status).toBe(404);
    expect((await outsider.html(`/o/${orgId}`)).status).toBe(404);
    expect((await outsider.raw("GET", `/api/orgs/${orgId}/events`)).status).toBe(404);
    expect(
      (await outsider.req("PUT", `/api/questions/${questionId}/response`, { text: "sneak", baseVersion: 0 })).status,
    ).toBe(404);
    expect((await outsider.req("POST", `/api/questions/${questionId}/close`, {})).status).toBe(404);

    // with no identity at all, too
    expect((await new Client().req("GET", `/api/orgs/${orgId}/snapshot`)).status).toBe(404);
    expect(code).toBeTruthy();
  });
});

describe("cross-site writes", () => {
  it("refuses writes that aren't application/json, which a cross-site form could send", async () => {
    const host = new Client();
    const { orgId } = await newOrg(host);
    const { questionId } = await startQuestion(host, orgId, { kind: "open" }, 30);
    const res = await fetch(new URL(`/api/questions/${questionId}/response`, baseUrl), {
      method: "PUT",
      headers: { cookie: host.cookieHeader, "content-type": "text/plain" },
      body: JSON.stringify({ text: "forged", baseVersion: 0 }),
    });
    expect([403, 415]).toContain(res.status);
    const snap = await host.req("GET", `/api/orgs/${orgId}/snapshot`);
    expect(snap.body.current.submittedCount).toBe(0);
  });
});
