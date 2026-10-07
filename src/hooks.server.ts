import type { Handle, ServerInit } from "@sveltejs/kit/hooks";
import { randomUUID } from "node:crypto";
import { resolveParticipant } from "#lib/server/identity.ts";
import { closeAllConnections } from "#lib/server/bus.ts";
import { log } from "#lib/server/log.ts";
import { recoverOnStartup, stopRevealTimers } from "#lib/server/service.ts";

export const init: ServerInit = () => {
  recoverOnStartup();
  // On a stop or redeploy, end live connections and timers at once so the
  // server can close; clients reconnect to the new process and resync.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      log("shutdown", { signal });
      stopRevealTimers();
      closeAllConnections();
    });
  }
};

export const handle: Handle = async ({ event, resolve }) => {
  const started = Date.now();
  event.locals.requestId = event.request.headers.get("fly-request-id") ?? randomUUID();
  event.locals.participantId = resolveParticipant(event.cookies);
  const response = await resolve(event);
  // the route id, never the raw URL, so ids in paths stay structured and
  // nothing a user typed lands in the log
  log("http", {
    requestId: event.locals.requestId,
    method: event.request.method,
    route: event.route.id,
    status: response.status,
    participantId: event.locals.participantId,
    ms: Date.now() - started,
  });
  response.headers.set("x-request-id", event.locals.requestId);
  return response;
};
