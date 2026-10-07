import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { Client, join, newOrg } from "./helpers.ts";

it("prefills an invitation without joining until the visitor submits", async () => {
  const { orgId, code } = await newOrg(new Client());
  const visitor = new Client();
  const home = await visitor.html(`/?code=${encodeURIComponent(code)}`);
  expect(home.status).toBe(200);
  const doc = new JSDOM(home.text).window.document;
  expect(doc.querySelector<HTMLInputElement>("#join-code")?.value).toBe(code);
  expect(visitor.cookieHeader).toBe("");
  expect((await visitor.req("GET", `/api/orgs/${orgId}/snapshot`)).status).toBe(404);
  await join(visitor, code, "Invited participant");
  const snapshot = await visitor.req("GET", `/api/orgs/${orgId}/snapshot`);
  expect(snapshot.status).toBe(200);
  expect(snapshot.body.me.isHost).toBe(false);
});
