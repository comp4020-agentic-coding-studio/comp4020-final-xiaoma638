import { actor } from "#lib/server/actor.ts";
import { handle, readJson } from "#lib/server/errors.ts";
import { revealNow } from "#lib/server/service.ts";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = (event) =>
  handle(async () => {
    const who = actor(event);
    await readJson(event.request);
    return revealNow(who, event.params.questionId);
  });
