import { json } from "@sveltejs/kit";

/** A refusal the caller can act on: an HTTP status, a stable code and a message for people. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const notFound = () =>
  new AppError(404, "not_found", "Not found, or you aren't a member of this organization.");
export const hostOnly = () => new AppError(403, "host_only", "Only the host can do that.");

/** Runs an endpoint body, turning AppErrors into JSON error responses. */
export async function handle(body: () => unknown | Promise<unknown>, status = 200): Promise<Response> {
  try {
    return json(await body(), { status });
  } catch (err) {
    if (err instanceof AppError) {
      return json({ error: err.code, message: err.message, ...err.extra }, { status: err.status });
    }
    throw err;
  }
}

/**
 * Parses a JSON request body, refusing anything that isn't an object. Every
 * write goes through here, and requiring application/json is the CSRF
 * defence: a cross-site page can't send that content type without a CORS
 * preflight, which this app never grants.
 */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AppError(415, "json_required", "Send the request as application/json.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError(400, "bad_json", "The request body must be JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(400, "bad_json", "The request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}
