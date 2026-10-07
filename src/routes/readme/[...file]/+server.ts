import { error } from "@sveltejs/kit";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { RequestHandler } from "./$types";

// Serves the images README.md links relatively, from docs/ only.
const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
const DOCS = resolve("docs");

export const GET: RequestHandler = async ({ params }) => {
  const path = resolve(params.file);
  const type = TYPES[extname(path).toLowerCase()];
  if (!type || !path.startsWith(DOCS + sep)) error(404, "Not found");
  try {
    return new Response(await readFile(path), { headers: { "content-type": type, "cache-control": "public, max-age=300" } });
  } catch {
    error(404, "Not found");
  }
};
