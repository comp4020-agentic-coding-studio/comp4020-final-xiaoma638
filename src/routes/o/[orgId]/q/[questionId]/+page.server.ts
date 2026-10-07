import { error } from "@sveltejs/kit";
import { AppError } from "#lib/server/errors.ts";
import { questionDetail } from "#lib/server/service.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, locals, setHeaders }) => {
  setHeaders({ "cache-control": "no-store" });
  try {
    const question = questionDetail(params.questionId, locals.participantId);
    return { question, orgId: params.orgId };
  } catch (err) {
    if (err instanceof AppError) error(err.status, err.message);
    throw err;
  }
};
