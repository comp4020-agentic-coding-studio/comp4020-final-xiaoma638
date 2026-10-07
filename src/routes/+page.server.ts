import { myOrgs } from "#lib/server/service.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, url }) => ({
  orgs: myOrgs(locals.participantId),
  hasIdentity: locals.participantId !== null,
  // A shared link fills the form; joining still requires an explicit submit.
  inviteCode: (url.searchParams.get("code") ?? "").trim().slice(0, 64),
});
