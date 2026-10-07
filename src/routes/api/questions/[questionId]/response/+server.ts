import { actor } from "#lib/server/actor.ts";
import { handle, readJson } from "#lib/server/errors.ts";
import { submitResponse } from "#lib/server/service.ts";
import type { RequestHandler } from "./$types";

export const PUT: RequestHandler = (event) =>
  handle(async () => submitResponse(actor(event), event.params.questionId, await readJson(event.request)));
