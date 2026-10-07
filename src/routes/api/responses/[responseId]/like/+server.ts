import { actor } from "#lib/server/actor.ts";
import { handle, readJson } from "#lib/server/errors.ts";
import { setLike } from "#lib/server/service.ts";
import type { RequestHandler } from "./$types";

// The body names the intended state ({"liked": true}), so a retry never toggles twice.
export const PUT: RequestHandler = (event) =>
  handle(async () => setLike(actor(event), event.params.responseId, await readJson(event.request)));
