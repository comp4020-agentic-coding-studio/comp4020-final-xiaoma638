// Structured logs, one JSON object per line on stdout, read through
// `fly logs`. Callers pass ids and outcomes only: never credentials, join
// codes, response bodies, selected options or keywords.

type Field = string | number | boolean | null | undefined;

export function log(event: string, fields: Record<string, Field> = {}): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}
