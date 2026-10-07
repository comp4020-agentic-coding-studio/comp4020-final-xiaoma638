import { newOrExistingActor } from "#lib/server/actor.ts";
import { handle, readJson } from "#lib/server/errors.ts";
import { createOrg } from "#lib/server/service.ts";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = (event) =>
  handle(async () => {
    const body = await readJson(event.request);
    return createOrg(newOrExistingActor(event), body);
  }, 201);
