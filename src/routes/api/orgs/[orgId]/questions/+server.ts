import { actor } from "#lib/server/actor.ts";
import { handle, readJson } from "#lib/server/errors.ts";
import { createQuestion } from "#lib/server/service.ts";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = (event) =>
  handle(async () => createQuestion(actor(event), event.params.orgId, await readJson(event.request)), 201);
