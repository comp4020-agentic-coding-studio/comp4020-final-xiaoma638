import { handle } from "#lib/server/errors.ts";
import { snapshot } from "#lib/server/service.ts";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params, locals, setHeaders }) => {
  setHeaders({ "cache-control": "no-store" });
  return handle(() => snapshot(params.orgId, locals.participantId));
};
