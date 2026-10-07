import { and, asc, count, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { randomInt, randomUUID } from "node:crypto";
import {
  LIMITS,
  checkText,
  compareBySubmission,
  effectivePhase,
  keywordFrequencies,
  normaliseTags,
  tallyChoices,
  type QuestionKind,
} from "../domain/rules.ts";
import type { HistoryItem, MyOrg, MyResponse, QuestionView, Results, Snapshot } from "../types.ts";
import { publish } from "./bus.ts";
import { db } from "./db/index.ts";
import { likes, memberships, options, orgs, questions, responseTags, responses } from "./db/schema.ts";
import { AppError, hostOnly, notFound } from "./errors.ts";
import { log } from "./log.ts";

// Every state transition, permission check and count lives here; the routes
// only parse requests and call in. Each write runs in one IMMEDIATE
// transaction, takes the server time inside it as the decision time, and
// publishes change notifications only after the commit.

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];
type Question = typeof questions.$inferSelect;

export type Actor = { participantId: string; requestId: string };

type Ctx = {
  /** The decision time for this transaction. */
  now: number;
  /** Bumps the org's version and queues a notification for after the commit. */
  touch(orgId: string): void;
  /** Runs once the transaction has committed. */
  after(fn: () => void): void;
};

function write<T>(fn: (tx: Tx, ctx: Ctx) => T): T {
  const changed = new Map<string, number>();
  const afterCommit: (() => void)[] = [];
  const result = db().transaction(
    (tx) => {
      const ctx: Ctx = {
        now: Date.now(),
        touch(orgId) {
          const row = tx
            .update(orgs)
            .set({ version: sql`${orgs.version} + 1` })
            .where(eq(orgs.id, orgId))
            .returning({ version: orgs.version })
            .get();
          if (row) changed.set(orgId, row.version);
        },
        after: (f) => afterCommit.push(f),
      };
      return fn(tx, ctx);
    },
    { behavior: "immediate" },
  );
  for (const [orgId, version] of changed) publish(orgId, version);
  for (const f of afterCommit) f();
  return result;
}

/** Logs a refusal with its outcome, then hands back the error to throw. */
function refuse(event: string, fields: Record<string, string | number | null>, err: AppError): AppError {
  log(event, { ...fields, outcome: "rejected", reason: err.code });
  return err;
}

// ---------------------------------------------------------------- reveal

const timers = new Map<string, NodeJS.Timeout>();

/**
 * Moves any of the org's questions whose deadline has passed from COLLECTING
 * to REVEALED. Idempotent: the UPDATE only matches questions still collecting,
 * so a retry, a late timer or a restart never reveals twice. The reveal time
 * recorded is the deadline itself, so a late reconcile can't stretch the window.
 */
function reconcile(tx: Tx, ctx: Ctx, orgId: string, trigger: string): void {
  const revealed = tx
    .update(questions)
    .set({ phase: "REVEALED", revealedAt: sql`${questions.deadline}` })
    .where(and(eq(questions.orgId, orgId), eq(questions.phase, "COLLECTING"), lte(questions.deadline, ctx.now)))
    .returning({ id: questions.id, deadline: questions.deadline })
    .all();
  for (const q of revealed) {
    ctx.touch(orgId);
    log("question_revealed", {
      orgId,
      questionId: q.id,
      trigger,
      deadline: q.deadline,
      reconciledLateMs: ctx.now - (q.deadline ?? ctx.now),
      outcome: "ok",
    });
  }
}

function scheduleReveal(orgId: string, questionId: string, deadline: number): void {
  clearTimeout(timers.get(questionId));
  // +1ms because a write at exactly the deadline is already refused
  const delay = Math.max(0, deadline - Date.now() + 1);
  timers.set(
    questionId,
    setTimeout(() => {
      timers.delete(questionId);
      const stillCollecting = write((tx, ctx) => {
        reconcile(tx, ctx, orgId, "timer");
        const q = tx.select({ phase: questions.phase }).from(questions).where(eq(questions.id, questionId)).get();
        return q?.phase === "COLLECTING";
      });
      if (stillCollecting) scheduleReveal(orgId, questionId, deadline);
    }, delay),
  );
}

/** On shutdown: drop pending reveal timers. The next startup reveals anything that expired meanwhile. */
export function stopRevealTimers(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

/** At startup: reveal whatever expired while the app was down, and re-arm timers for the rest. */
export function recoverOnStartup(): void {
  const collecting = db()
    .select({ id: questions.id, orgId: questions.orgId, deadline: questions.deadline })
    .from(questions)
    .where(eq(questions.phase, "COLLECTING"))
    .all();
  write((tx, ctx) => {
    for (const orgId of new Set(collecting.map((q) => q.orgId))) reconcile(tx, ctx, orgId, "startup");
  });
  let armed = 0;
  for (const q of collecting) {
    if (q.deadline !== null && q.deadline > Date.now()) {
      scheduleReveal(q.orgId, q.id, q.deadline);
      armed++;
    }
  }
  log("startup_recovered", { collecting: collecting.length, timersArmed: armed, outcome: "ok" });
}

// ---------------------------------------------------------------- lookups

function membership(tx: Tx, orgId: string, participantId: string | null) {
  if (!participantId) return null;
  return (
    tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.participantId, participantId)))
      .get() ?? null
  );
}

function requireMember(tx: Tx, orgId: string, participantId: string | null) {
  const m = membership(tx, orgId, participantId);
  if (!m) throw notFound();
  return m;
}

/** A question the caller can see: it exists and they belong to its org. Otherwise "not found", either way. */
function requireQuestion(tx: Tx, questionId: string, participantId: string | null) {
  const q = tx.select().from(questions).where(eq(questions.id, questionId)).get();
  if (!q) throw notFound();
  const m = requireMember(tx, q.orgId, participantId);
  return { q, m };
}

function reload(tx: Tx, questionId: string): Question {
  return tx.select().from(questions).where(eq(questions.id, questionId)).get()!;
}

function questionOptions(tx: Tx, questionId: string) {
  return tx
    .select({ id: options.id, label: options.label })
    .from(options)
    .where(eq(options.questionId, questionId))
    .orderBy(asc(options.position))
    .all();
}

function tagsFor(tx: Tx, responseIds: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (responseIds.length === 0) return out;
  const rows = tx
    .select()
    .from(responseTags)
    .where(inArray(responseTags.responseId, responseIds))
    .orderBy(asc(responseTags.keyword))
    .all();
  for (const r of rows) out.set(r.responseId, [...(out.get(r.responseId) ?? []), r.keyword]);
  return out;
}

function myResponse(tx: Tx, questionId: string, participantId: string): MyResponse | null {
  const r = tx
    .select()
    .from(responses)
    .where(and(eq(responses.questionId, questionId), eq(responses.participantId, participantId)))
    .get();
  if (!r) return null;
  return { optionId: r.optionId, text: r.text, tags: tagsFor(tx, [r.id]).get(r.id) ?? [], version: r.version };
}

function submittedCount(tx: Tx, questionId: string): number {
  return tx.select({ n: count() }).from(responses).where(eq(responses.questionId, questionId)).get()?.n ?? 0;
}

function results(tx: Tx, q: Question, participantId: string): Results {
  const rows = tx
    .select()
    .from(responses)
    .where(eq(responses.questionId, q.id))
    .all();
  if (q.kind === "choice") {
    const tally = tallyChoices(
      questionOptions(tx, q.id),
      rows.map((r) => r.optionId ?? ""),
    );
    return { kind: "choice", ...tally };
  }
  const ids = rows.map((r) => r.id);
  const tags = tagsFor(tx, ids);
  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  if (ids.length > 0) {
    for (const l of tx.select().from(likes).where(inArray(likes.responseId, ids)).all()) {
      likeCounts.set(l.responseId, (likeCounts.get(l.responseId) ?? 0) + 1);
      if (l.participantId === participantId) likedByMe.add(l.responseId);
    }
  }
  const open = rows
    .map((r) => ({
      id: r.id,
      text: r.text ?? "",
      tags: tags.get(r.id) ?? [],
      likeCount: likeCounts.get(r.id) ?? 0,
      likedByMe: likedByMe.has(r.id),
      mine: r.participantId === participantId,
      submittedAt: r.submittedAt,
    }))
    .sort(compareBySubmission);
  return {
    kind: "open",
    total: open.length,
    responses: open,
    keywords: keywordFrequencies(open.map((r) => r.tags)),
  };
}

/** The question as this participant may see it. Others' answers appear only after the reveal. */
function view(tx: Tx, q: Question, participantId: string, now: number): QuestionView {
  const phase = effectivePhase(q.phase, q.deadline, now);
  const shown = phase === "REVEALED" || phase === "CLOSED";
  return {
    id: q.id,
    kind: q.kind,
    prompt: q.prompt,
    options: questionOptions(tx, q.id),
    durationSec: q.durationSec,
    phase,
    deadline: q.deadline,
    revealedAt: q.revealedAt,
    closedAt: q.closedAt,
    submittedCount: submittedCount(tx, q.id),
    myResponse: myResponse(tx, q.id, participantId),
    results: shown ? results(tx, q, participantId) : null,
  };
}

// ---------------------------------------------------------------- organizations

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newJoinCode(tx: Tx): string {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    if (!tx.select({ id: orgs.id }).from(orgs).where(eq(orgs.joinCode, code)).get()) return code;
  }
}

function checked<T>(result: { ok: true; value: T } | { ok: false; error: string }, field: string): T {
  if (!result.ok) throw new AppError(400, "invalid", result.error, { field });
  return result.value;
}

export function createOrg(actor: Actor, body: Record<string, unknown>): { orgId: string } {
  const name = checked(checkText(body.name, "Organization name", LIMITS.orgName), "name");
  const nickname = checked(checkText(body.nickname, "Nickname", LIMITS.nickname), "nickname");
  return write((tx, ctx) => {
    const orgId = randomUUID();
    tx.insert(orgs)
      .values({ id: orgId, name, joinCode: newJoinCode(tx), createdBy: actor.participantId, createdAt: ctx.now })
      .run();
    tx.insert(memberships)
      .values({ orgId, participantId: actor.participantId, nickname, role: "host", joinedAt: ctx.now })
      .run();
    ctx.touch(orgId);
    log("org_created", { requestId: actor.requestId, orgId, participantId: actor.participantId, outcome: "ok" });
    return { orgId };
  });
}

export function joinOrg(actor: Actor, body: Record<string, unknown>): { orgId: string } {
  const nickname = checked(checkText(body.nickname, "Nickname", LIMITS.nickname), "nickname");
  const code = typeof body.code === "string" ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  return write((tx, ctx) => {
    const org = code ? tx.select({ id: orgs.id }).from(orgs).where(eq(orgs.joinCode, code)).get() : undefined;
    const fields = { requestId: actor.requestId, participantId: actor.participantId };
    if (!org) {
      throw refuse("org_joined", fields, new AppError(404, "bad_code", "No organization has that join code.", { field: "code" }));
    }
    const existing = membership(tx, org.id, actor.participantId);
    if (existing) {
      // a join code grants membership only; joining again never changes the role
      tx.update(memberships)
        .set({ nickname })
        .where(and(eq(memberships.orgId, org.id), eq(memberships.participantId, actor.participantId)))
        .run();
    } else {
      tx.insert(memberships)
        .values({ orgId: org.id, participantId: actor.participantId, nickname, role: "member", joinedAt: ctx.now })
        .run();
    }
    ctx.touch(org.id);
    log("org_joined", { ...fields, orgId: org.id, rejoin: existing !== null, outcome: "ok" });
    return { orgId: org.id };
  });
}

export function myOrgs(participantId: string | null): MyOrg[] {
  if (!participantId) return [];
  return db()
    .select({ id: orgs.id, name: orgs.name, nickname: memberships.nickname, role: memberships.role })
    .from(memberships)
    .innerJoin(orgs, eq(orgs.id, memberships.orgId))
    .where(eq(memberships.participantId, participantId))
    .orderBy(desc(memberships.joinedAt))
    .all()
    .map((r) => ({ id: r.id, name: r.name, nickname: r.nickname, isHost: r.role === "host" }));
}

/** Everything the org page shows, filtered for this participant. Throws "not found" to non-members. */
export function snapshot(orgId: string, participantId: string | null): Snapshot {
  return write((tx, ctx) => {
    const m = requireMember(tx, orgId, participantId);
    reconcile(tx, ctx, orgId, "read");
    const org = tx.select().from(orgs).where(eq(orgs.id, orgId)).get()!;
    const memberCount = tx.select({ n: count() }).from(memberships).where(eq(memberships.orgId, orgId)).get()?.n ?? 0;
    const open = tx
      .select()
      .from(questions)
      .where(and(eq(questions.orgId, orgId), ne(questions.phase, "CLOSED")))
      .get();
    const closed = tx
      .select({
        id: questions.id,
        kind: questions.kind,
        prompt: questions.prompt,
        phase: questions.phase,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .where(and(eq(questions.orgId, orgId), eq(questions.phase, "CLOSED")))
      .orderBy(desc(questions.createdAt))
      .all();
    const history: HistoryItem[] = closed.map((q) => ({ ...q, submittedCount: submittedCount(tx, q.id) }));
    return {
      version: org.version,
      now: ctx.now,
      org: { id: org.id, name: org.name, joinCode: org.joinCode, memberCount },
      me: { id: m.participantId, nickname: m.nickname, isHost: m.role === "host" },
      current: open ? view(tx, open, m.participantId, ctx.now) : null,
      history,
    };
  });
}

export function questionDetail(questionId: string, participantId: string | null): QuestionView {
  return write((tx, ctx) => {
    const { q, m } = requireQuestion(tx, questionId, participantId);
    reconcile(tx, ctx, q.orgId, "read");
    return view(tx, reload(tx, q.id), m.participantId, ctx.now);
  });
}

// ---------------------------------------------------------------- questions

function parseQuestion(body: Record<string, unknown>) {
  const kind = body.kind;
  if (kind !== "choice" && kind !== "open") {
    throw new AppError(400, "invalid", "Pick a question type.", { field: "kind" });
  }
  const prompt = checked(checkText(body.prompt, "Question", LIMITS.prompt), "prompt");
  const durationSec = body.durationSec;
  if (
    typeof durationSec !== "number" ||
    !Number.isInteger(durationSec) ||
    durationSec < LIMITS.minDurationSec ||
    durationSec > LIMITS.maxDurationSec
  ) {
    throw new AppError(
      400,
      "invalid",
      `Duration must be a whole number of seconds from ${LIMITS.minDurationSec} to ${LIMITS.maxDurationSec}.`,
      { field: "durationSec" },
    );
  }
  let labels: string[] = [];
  if (kind === "choice") {
    if (!Array.isArray(body.options)) throw new AppError(400, "invalid", "Add the options.", { field: "options" });
    labels = body.options
      .filter((o) => typeof o !== "string" || o.trim() !== "")
      .map((o, i) => checked(checkText(o, `Option ${i + 1}`, LIMITS.option), "options"));
    if (labels.length < LIMITS.minOptions || labels.length > LIMITS.maxOptions) {
      throw new AppError(400, "invalid", `A choice question needs ${LIMITS.minOptions} to ${LIMITS.maxOptions} options.`, {
        field: "options",
      });
    }
  }
  return { kind: kind as QuestionKind, prompt, durationSec, labels };
}

function insertOptions(tx: Tx, questionId: string, labels: string[]) {
  labels.forEach((label, position) => {
    tx.insert(options).values({ id: randomUUID(), questionId, position, label }).run();
  });
}

export function createQuestion(actor: Actor, orgId: string, body: Record<string, unknown>): { questionId: string } {
  return write((tx, ctx) => {
    const m = requireMember(tx, orgId, actor.participantId);
    if (m.role !== "host") throw hostOnly();
    const parsed = parseQuestion(body);
    reconcile(tx, ctx, orgId, "write");
    const busy = tx
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.orgId, orgId), ne(questions.phase, "CLOSED")))
      .get();
    if (busy) {
      throw new AppError(409, "question_open", "Close the current question before starting another.");
    }
    const questionId = randomUUID();
    tx.insert(questions)
      .values({
        id: questionId,
        orgId,
        kind: parsed.kind,
        prompt: parsed.prompt,
        durationSec: parsed.durationSec,
        phase: "DRAFT",
        createdBy: actor.participantId,
        createdAt: ctx.now,
      })
      .run();
    insertOptions(tx, questionId, parsed.labels);
    ctx.touch(orgId);
    log("question_drafted", { requestId: actor.requestId, orgId, questionId, kind: parsed.kind, outcome: "ok" });
    return { questionId };
  });
}

export function updateDraft(actor: Actor, questionId: string, body: Record<string, unknown>): { questionId: string } {
  return write((tx, ctx) => {
    const { q, m } = requireQuestion(tx, questionId, actor.participantId);
    if (m.role !== "host") throw hostOnly();
    if (q.phase !== "DRAFT") throw new AppError(409, "locked", "The question is locked once collection starts.");
    const parsed = parseQuestion(body);
    tx.update(questions)
      .set({ kind: parsed.kind, prompt: parsed.prompt, durationSec: parsed.durationSec })
      .where(eq(questions.id, q.id))
      .run();
    tx.delete(options).where(eq(options.questionId, q.id)).run();
    insertOptions(tx, q.id, parsed.labels);
    ctx.touch(q.orgId);
    log("question_edited", { requestId: actor.requestId, orgId: q.orgId, questionId, outcome: "ok" });
    return { questionId };
  });
}

export function startCollection(actor: Actor, questionId: string): { deadline: number } {
  return write((tx, ctx) => {
    const { q, m } = requireQuestion(tx, questionId, actor.participantId);
    const fields = { requestId: actor.requestId, orgId: q.orgId, questionId, participantId: actor.participantId };
    if (m.role !== "host") throw refuse("collection_started", fields, hostOnly());
    if (q.phase !== "DRAFT") {
      throw refuse("collection_started", fields, new AppError(409, "already_started", "Collection has already started."));
    }
    const deadline = ctx.now + q.durationSec * 1000;
    tx.update(questions).set({ phase: "COLLECTING", deadline }).where(eq(questions.id, q.id)).run();
    ctx.touch(q.orgId);
    ctx.after(() => scheduleReveal(q.orgId, q.id, deadline));
    log("collection_started", { ...fields, durationSec: q.durationSec, deadline, outcome: "ok" });
    return { deadline };
  });
}

export function closeQuestion(actor: Actor, questionId: string): { closedAt: number } {
  return write((tx, ctx) => {
    const { q, m } = requireQuestion(tx, questionId, actor.participantId);
    const fields = { requestId: actor.requestId, orgId: q.orgId, questionId, participantId: actor.participantId };
    if (m.role !== "host") throw refuse("discussion_closed", fields, hostOnly());
    reconcile(tx, ctx, q.orgId, "write");
    const phase = reload(tx, q.id).phase;
    if (phase !== "REVEALED") {
      throw refuse(
        "discussion_closed",
        fields,
        new AppError(409, "not_revealed", phase === "CLOSED" ? "This discussion is already closed." : "Results aren't revealed yet."),
      );
    }
    tx.update(questions).set({ phase: "CLOSED", closedAt: ctx.now }).where(eq(questions.id, q.id)).run();
    ctx.touch(q.orgId);
    log("discussion_closed", { ...fields, outcome: "ok" });
    return { closedAt: ctx.now };
  });
}

// ---------------------------------------------------------------- responses

export function submitResponse(actor: Actor, questionId: string, body: Record<string, unknown>): MyResponse {
  // A late write is refused, but the reveal it discovered still commits, so the
  // refusal comes back as a value and is thrown only after the transaction.
  const outcome = write((tx, ctx): MyResponse | { refused: AppError } => {
    const { q } = requireQuestion(tx, questionId, actor.participantId);
    const fields = { requestId: actor.requestId, orgId: q.orgId, questionId, participantId: actor.participantId };
    const phase = effectivePhase(q.phase, q.deadline, ctx.now);
    if (phase !== "COLLECTING") {
      // a refusal still commits the reveal it discovered
      reconcile(tx, ctx, q.orgId, "write");
      const late = phase === "REVEALED" || phase === "CLOSED";
      const err = new AppError(
        409,
        late ? "deadline_passed" : "not_collecting",
        late ? "Collection has closed, so this answer wasn't saved." : "Collection hasn't started yet.",
      );
      log("response_submitted", {
        ...fields,
        outcome: "rejected",
        reason: err.code,
        msAfterDeadline: q.deadline === null ? null : ctx.now - q.deadline,
      });
      return { refused: err };
    }

    const baseVersion = body.baseVersion;
    if (typeof baseVersion !== "number" || !Number.isInteger(baseVersion) || baseVersion < 0) {
      throw new AppError(400, "invalid", "Missing the response version this edit is based on.");
    }
    let optionId: string | null = null;
    let text: string | null = null;
    let tags: string[] = [];
    if (q.kind === "choice") {
      const valid = questionOptions(tx, q.id).some((o) => o.id === body.optionId);
      if (!valid) throw new AppError(400, "invalid", "Pick one of this question's options.", { field: "optionId" });
      optionId = body.optionId as string;
    } else {
      text = checked(checkText(body.text, "Your answer", LIMITS.openText), "text");
      tags = checked(normaliseTags(body.tags), "tags");
    }

    const existing = tx
      .select()
      .from(responses)
      .where(and(eq(responses.questionId, q.id), eq(responses.participantId, actor.participantId)))
      .get();
    const current = existing ? myResponse(tx, q.id, actor.participantId) : null;
    const same =
      current !== null &&
      current.optionId === optionId &&
      current.text === text &&
      current.tags.join("\n") === [...tags].sort().join("\n");

    if ((existing?.version ?? 0) !== baseVersion) {
      // a retry of a write that already landed is a success, not a conflict
      if (same) return current;
      log("response_submitted", { ...fields, outcome: "rejected", reason: "stale_version", baseVersion });
      throw new AppError(409, "stale_version", "Your answer changed somewhere else (another tab?). Review it and save again.", {
        current,
      });
    }

    let responseId: string;
    let version: number;
    if (existing) {
      responseId = existing.id;
      version = existing.version + 1;
      tx.update(responses).set({ optionId, text, version, updatedAt: ctx.now }).where(eq(responses.id, existing.id)).run();
      tx.delete(responseTags).where(eq(responseTags.responseId, existing.id)).run();
    } else {
      responseId = randomUUID();
      version = 1;
      tx.insert(responses)
        .values({
          id: responseId,
          questionId: q.id,
          participantId: actor.participantId,
          optionId,
          text,
          version,
          submittedAt: ctx.now,
          updatedAt: ctx.now,
        })
        .run();
    }
    for (const keyword of tags) tx.insert(responseTags).values({ responseId, keyword }).run();
    ctx.touch(q.orgId);
    log(existing ? "response_edited" : "response_submitted", {
      ...fields,
      version,
      msBeforeDeadline: (q.deadline ?? ctx.now) - ctx.now,
      outcome: "ok",
    });
    return myResponse(tx, q.id, actor.participantId)!;
  });
  if ("refused" in outcome) throw outcome.refused;
  return outcome;
}

export function setLike(actor: Actor, responseId: string, body: Record<string, unknown>): { liked: boolean; likeCount: number } {
  if (typeof body.liked !== "boolean") throw new AppError(400, "invalid", "Say whether to like or unlike.");
  const liked = body.liked;
  return write((tx, ctx) => {
    const r = tx.select().from(responses).where(eq(responses.id, responseId)).get();
    if (!r) throw notFound();
    const { q } = requireQuestion(tx, r.questionId, actor.participantId);
    const fields = { requestId: actor.requestId, orgId: q.orgId, questionId: q.id, participantId: actor.participantId };
    const event = liked ? "response_liked" : "response_unliked";
    reconcile(tx, ctx, q.orgId, "write");
    const phase = reload(tx, q.id).phase;
    if (q.kind !== "open") throw refuse(event, fields, new AppError(409, "not_open_question", "Only open answers can be liked."));
    if (phase === "CLOSED") throw refuse(event, fields, new AppError(409, "discussion_closed", "This discussion is closed."));
    if (phase !== "REVEALED") throw refuse(event, fields, new AppError(409, "not_revealed", "Answers aren't revealed yet."));
    if (r.participantId === actor.participantId) {
      throw refuse(event, fields, new AppError(403, "own_response", "You can't like your own answer."));
    }
    const changed = liked
      ? tx.insert(likes).values({ responseId, participantId: actor.participantId, createdAt: ctx.now }).onConflictDoNothing().run().changes
      : tx
          .delete(likes)
          .where(and(eq(likes.responseId, responseId), eq(likes.participantId, actor.participantId)))
          .run().changes;
    if (changed > 0) ctx.touch(q.orgId);
    const likeCount = tx.select({ n: count() }).from(likes).where(eq(likes.responseId, responseId)).get()?.n ?? 0;
    log(event, { ...fields, changed: changed > 0, outcome: "ok" });
    return { liked, likeCount };
  });
}

// ---------------------------------------------------------------- subscriptions

/** The org's current version, for a member opening a live connection. Throws "not found" otherwise. */
export function versionForMember(orgId: string, participantId: string | null): number {
  return write((tx, ctx) => {
    requireMember(tx, orgId, participantId);
    reconcile(tx, ctx, orgId, "read");
    return tx.select({ version: orgs.version }).from(orgs).where(eq(orgs.id, orgId)).get()!.version;
  });
}
