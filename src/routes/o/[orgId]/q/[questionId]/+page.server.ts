import { error } from "@sveltejs/kit";
import { AppError } from "#lib/server/errors.ts";
import { historyDetail } from "#lib/server/service.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, locals, setHeaders }) => {
  setHeaders({ "cache-control": "no-store" });
  try {
    // The org comes from the question, so a mismatched URL can't point "Ask again" elsewhere.
    return historyDetail(params.questionId, locals.participantId);
  } catch (err) {
    if (err instanceof AppError) error(err.status, err.message);
    throw err;
  }
};
