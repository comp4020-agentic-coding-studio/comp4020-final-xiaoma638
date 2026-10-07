import { actor } from "#lib/server/actor.ts";
import { handle, readJson } from "#lib/server/errors.ts";
import { questionDetail, updateDraft } from "#lib/server/service.ts";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params, locals, setHeaders }) => {
  setHeaders({ "cache-control": "no-store" });
  return handle(() => questionDetail(params.questionId, locals.participantId));
};

export const PUT: RequestHandler = (event) =>
  handle(async () => updateDraft(actor(event), event.params.questionId, await readJson(event.request)));
