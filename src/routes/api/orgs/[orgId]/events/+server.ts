import { subscribe, trackConnection } from "#lib/server/bus.ts";
import { handle } from "#lib/server/errors.ts";
import { log } from "#lib/server/log.ts";
import { versionForMember } from "#lib/server/service.ts";
import type { RequestHandler } from "./$types";

const HEARTBEAT_MS = 15_000;

// Server-sent events. Each message carries only the org's new version; the
// client then fetches its own filtered snapshot, so nothing hidden can travel
// down this stream even by mistake.
export const GET: RequestHandler = async ({ params, locals, request }) => {
  let version: number;
  try {
    version = versionForMember(params.orgId, locals.participantId);
  } catch {
    return handle(() => versionForMember(params.orgId, locals.participantId));
  }

  const fields = { requestId: locals.requestId, orgId: params.orgId, participantId: locals.participantId };
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const change = (v: number) => send(`event: change\ndata: ${JSON.stringify({ version: v })}\n\n`);

      send("retry: 2000\n\n");
      change(version);
      const unsubscribe = subscribe(params.orgId, change);
      const heartbeat = setInterval(() => send(": heartbeat\n\n"), HEARTBEAT_MS);
      const opened = Date.now();
      log("live_opened", { ...fields, outcome: "ok" });

      let done = false;
      const untrack = trackConnection(() => cleanup());
      cleanup = () => {
        if (done) return;
        done = true;
        untrack();
        unsubscribe();
        clearInterval(heartbeat);
        log("live_closed", { ...fields, ms: Date.now() - opened });
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
};
