import type { RequestEvent } from "@sveltejs/kit";
import { ensureParticipant } from "./identity.ts";
import { AppError } from "./errors.ts";
import type { Actor } from "./service.ts";

/** The caller as an existing identity; anyone without one can't be a member of anything yet. */
export function actor(event: RequestEvent): Actor {
  if (!event.locals.participantId) throw new AppError(404, "not_found", "Not found, or you aren't a member of this organization.");
  return { participantId: event.locals.participantId, requestId: event.locals.requestId };
}

/** The caller, creating a browser identity if they don't have one: the entry points only. */
export function newOrExistingActor(event: RequestEvent): Actor {
  const participantId = ensureParticipant(event.locals, event.cookies, event.url.protocol === "https:");
  return { participantId, requestId: event.locals.requestId };
}
