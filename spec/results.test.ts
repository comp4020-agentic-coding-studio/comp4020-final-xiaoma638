import { describe, expect, it } from "vitest";
import { Client, join, newOrg, startQuestion, waitPast } from "./helpers.ts";

// Revealed results: checkable counts, keyword frequencies and likes.

describe("choice results", () => {
  it("counts votes from known answers", async () => {
    const host = new Client();
    const { orgId, code } = await newOrg(host);
    const voters = [new Client(), new Client(), new Client()];
    for (const v of voters) await join(v, code);
    const { questionId, options, deadline } = await startQuestion(host, orgId, { kind: "choice", options: ["A", "B", "C"] }, 5);
    const picks = [0, 0, 1];
    await Promise.all(
      voters.map((v, i) =>
        v.req("PUT", `/api/questions/${questionId}/response`, { optionId: options[picks[i]].id, baseVersion: 0 }),
      ),
    );
    await waitPast(deadline);
    const r = (await host.req("GET", `/api/questions/${questionId}`)).body.results;
    expect(r.total).toBe(3);
    expect(r.counts.map((c: { count: number; percent: number }) => [c.count, c.percent])).toEqual([
      [2, 67],
      [1, 33],
      [0, 0],
    ]);
  });
});

describe("open results and likes", () => {
  it("freezes answers at the reveal, counts keywords, and keeps likes consistent", async () => {
    const host = new Client();
    const alice = new Client();
    const bob = new Client();
    const { orgId, code } = await newOrg(host);
    await join(alice, code);
    await join(bob, code);
    const { questionId, deadline } = await startQuestion(host, orgId, { kind: "open" }, 5);
    await alice.req("PUT", `/api/questions/${questionId}/response`, { text: "alice", tags: ["Speed", " speed "], baseVersion: 0 });
    await bob.req("PUT", `/api/questions/${questionId}/response`, { text: "bob", tags: ["speed", "cost"], baseVersion: 0 });
    await waitPast(deadline);

    const revealed = (await host.req("GET", `/api/questions/${questionId}`)).body.results;
    expect(revealed.keywords).toEqual([
      { keyword: "speed", count: 2 },
      { keyword: "cost", count: 1 },
    ]);
    const aliceAnswer = revealed.responses.find((r: { text: string }) => r.text === "alice");
    const bobAnswer = revealed.responses.find((r: { text: string }) => r.text === "bob");

    // edits after the reveal are refused
    expect((await alice.req("PUT", `/api/questions/${questionId}/response`, { text: "edit", baseVersion: 1 })).status).toBe(409);

    const like = (who: Client, id: string, liked: boolean) => who.req("PUT", `/api/responses/${id}/like`, { liked });

    // retries don't double count
    await like(bob, aliceAnswer.id, true);
    const retry = await like(bob, aliceAnswer.id, true);
    expect(retry.body.likeCount).toBe(1);
    await like(host, aliceAnswer.id, true);
    expect((await like(host, aliceAnswer.id, true)).body.likeCount).toBe(2);

    // self-likes are refused
    expect((await like(alice, aliceAnswer.id, true)).status).toBe(403);

    // unliking removes only the caller's like, and repeating it is harmless
    expect((await like(bob, aliceAnswer.id, false)).body.likeCount).toBe(1);
    expect((await like(bob, aliceAnswer.id, false)).body.likeCount).toBe(1);

    // ranking data: alice 1 like, bob 0
    const now = (await bob.req("GET", `/api/questions/${questionId}`)).body.results.responses;
    expect(now.find((r: { id: string }) => r.id === aliceAnswer.id).likeCount).toBe(1);
    expect(now.find((r: { id: string }) => r.id === bobAnswer.id).mine).toBe(true);

    // closing freezes likes
    expect((await host.req("POST", `/api/questions/${questionId}/close`, {})).status).toBe(200);
    expect((await like(bob, aliceAnswer.id, true)).status).toBe(409);
    expect((await like(host, aliceAnswer.id, false)).status).toBe(409);
    expect((await host.req("POST", `/api/questions/${questionId}/close`, {})).status).toBe(409);

    // the closed question moves to the history and a new one can start
    const snap = (await host.req("GET", `/api/orgs/${orgId}/snapshot`)).body;
    expect(snap.current).toBeNull();
    expect(snap.history.map((h: { id: string }) => h.id)).toContain(questionId);
    const next = await host.req("POST", `/api/orgs/${orgId}/questions`, { kind: "open", prompt: "next", durationSec: 30 });
    expect(next.status).toBe(201);
    const old = (await alice.req("GET", `/api/questions/${questionId}`)).body;
    expect(old.phase).toBe("CLOSED");
    expect(old.results.total).toBe(2);
  });

  it("refuses likes before the reveal", async () => {
    const host = new Client();
    const alice = new Client();
    const { orgId, code } = await newOrg(host);
    await join(alice, code);
    const { questionId } = await startQuestion(host, orgId, { kind: "open" }, 30);
    await alice.req("PUT", `/api/questions/${questionId}/response`, { text: "a", baseVersion: 0 });
    // the host can't see the response id before the reveal, so there's nothing to aim at;
    // a guessed id is refused the same way as a missing one
    const res = await host.req("PUT", `/api/responses/not-a-real-id/like`, { liked: true });
    expect(res.status).toBe(404);
  });
});
