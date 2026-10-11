import { error } from "@sveltejs/kit";
import { AppError } from "#lib/server/errors.ts";
import { snapshot } from "#lib/server/service.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, locals, setHeaders }) => {
  setHeaders({ "cache-control": "no-store" });
  try {
    return { snapshot: snapshot(params.orgId, locals.participantId) };
  } catch (err) {
    if (err instanceof AppError) error(err.status, err.message);
    throw err;
  }
};
