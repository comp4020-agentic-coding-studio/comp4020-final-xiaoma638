import { newOrExistingActor } from "#lib/server/actor.ts";
import { handle, readJson } from "#lib/server/errors.ts";
import { joinOrg } from "#lib/server/service.ts";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = (event) =>
  handle(async () => {
    const body = await readJson(event.request);
    return joinOrg(newOrExistingActor(event), body);
  });
