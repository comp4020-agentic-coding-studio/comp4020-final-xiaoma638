import type { Cookies } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "./db/index.ts";
import { participants } from "./db/schema.ts";
import { log } from "./log.ts";

// A browser identity: the server picks a random participant id and hands the
// browser an unguessable credential in an httpOnly cookie. Only the
// credential's hash is stored. Clearing cookies or switching browsers starts
// a new identity, which the interface says.

export const CREDENTIAL_COOKIE = "srw_credential";
const MAX_AGE_SEC = 400 * 24 * 60 * 60;

const hash = (credential: string) => createHash("sha256").update(credential).digest("hex");

export function resolveParticipant(cookies: Cookies): string | null {
  const credential = cookies.get(CREDENTIAL_COOKIE);
  if (!credential) return null;
  const row = db()
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.credentialHash, hash(credential)))
    .get();
  return row?.id ?? null;
}

/** The caller's participant id, creating an identity (and setting its cookie) if they have none. */
export function ensureParticipant(locals: App.Locals, cookies: Cookies, secure: boolean): string {
  if (locals.participantId) return locals.participantId;
  const credential = randomBytes(32).toString("base64url");
  const id = randomUUID();
  db().insert(participants).values({ id, credentialHash: hash(credential), createdAt: Date.now() }).run();
  cookies.set(CREDENTIAL_COOKIE, credential, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: MAX_AGE_SEC,
  });
  locals.participantId = id;
  log("identity_created", { requestId: locals.requestId, participantId: id });
  return id;
}
