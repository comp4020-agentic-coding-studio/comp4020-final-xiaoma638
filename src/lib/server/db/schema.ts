import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// All times are milliseconds since the epoch, taken from the server clock.

export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  // sha-256 of the browser's credential; the credential itself is never stored
  credentialHash: text("credential_hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const orgs = sqliteTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  joinCode: text("join_code").notNull().unique(),
  // bumped in the same transaction as every change in the org, so snapshots
  // can be ordered and an older one never overwrites a newer one
  version: integer("version").notNull().default(0),
  createdBy: text("created_by")
    .notNull()
    .references(() => participants.id),
  createdAt: integer("created_at").notNull(),
});

export const memberships = sqliteTable(
  "memberships",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id),
    nickname: text("nickname").notNull(),
    role: text("role", { enum: ["host", "member"] }).notNull(),
    joinedAt: integer("joined_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.participantId] }),
    index("memberships_participant").on(t.participantId),
    check("memberships_role", sql`${t.role} in ('host', 'member')`),
  ],
);

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    kind: text("kind", { enum: ["choice", "open"] }).notNull(),
    prompt: text("prompt").notNull(),
    durationSec: integer("duration_sec").notNull(),
    phase: text("phase", { enum: ["DRAFT", "COLLECTING", "REVEALED", "CLOSED"] }).notNull(),
    deadline: integer("deadline"),
    revealedAt: integer("revealed_at"),
    closedAt: integer("closed_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => participants.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    // one question at a time: at most one that isn't CLOSED per organization
    uniqueIndex("questions_one_open_per_org").on(t.orgId).where(sql`phase <> 'CLOSED'`),
    index("questions_org").on(t.orgId, t.createdAt),
    check("questions_kind", sql`${t.kind} in ('choice', 'open')`),
    check("questions_phase", sql`${t.phase} in ('DRAFT', 'COLLECTING', 'REVEALED', 'CLOSED')`),
    check("questions_deadline", sql`${t.phase} = 'DRAFT' or ${t.deadline} is not null`),
  ],
);

export const options = sqliteTable(
  "options",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id),
    position: integer("position").notNull(),
    label: text("label").notNull(),
  },
  (t) => [uniqueIndex("options_position").on(t.questionId, t.position)],
);

export const responses = sqliteTable(
  "responses",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id),
    optionId: text("option_id").references(() => options.id),
    text: text("text"),
    version: integer("version").notNull(),
    submittedAt: integer("submitted_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("responses_one_per_participant").on(t.questionId, t.participantId),
    check("responses_body", sql`${t.optionId} is not null or ${t.text} is not null`),
  ],
);

export const responseTags = sqliteTable(
  "response_tags",
  {
    responseId: text("response_id")
      .notNull()
      .references(() => responses.id),
    keyword: text("keyword").notNull(),
  },
  (t) => [primaryKey({ columns: [t.responseId, t.keyword] })],
);

export const likes = sqliteTable(
  "likes",
  {
    responseId: text("response_id")
      .notNull()
      .references(() => responses.id),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.responseId, t.participantId] })],
);
