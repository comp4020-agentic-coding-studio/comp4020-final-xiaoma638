import { inject } from "vitest";

// A browser stand-in for the spec: its own cookie jar, so each Client is one
// independent identity talking to the running app over HTTP.

export const baseUrl = inject("baseUrl");
const protocolHeader = inject("protocolHeader");
const proxyHeaders = protocolHeader ? { [protocolHeader]: new URL(baseUrl).protocol.slice(0, -1) } : {};

export type Reply<T = any> = { status: number; body: T };

export class Client {
  #cookies = new Map<string, string>();

  #remember(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const at = pair.indexOf("=");
      this.#cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
  }

  get cookieHeader(): string {
    return [...this.#cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async raw(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetch(new URL(path, baseUrl), {
      method,
      headers: {
        ...proxyHeaders,
        cookie: this.cookieHeader,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    this.#remember(res);
    return res;
  }

  async req<T = any>(method: string, path: string, body?: unknown): Promise<Reply<T>> {
    const res = await this.raw(method, path, body);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  async html(path: string): Promise<{ status: number; text: string }> {
    const res = await this.raw("GET", path);
    return { status: res.status, text: await res.text() };
  }
}

export const unique = (label: string) => `${label}-${Math.random().toString(36).slice(2, 10)}`;

export async function newOrg(host: Client): Promise<{ orgId: string; code: string }> {
  const created = await host.req("POST", "/api/orgs", { name: unique("org"), nickname: "Host" });
  if (created.status !== 201) throw new Error(`create org: ${created.status} ${JSON.stringify(created.body)}`);
  const snap = await host.req("GET", `/api/orgs/${created.body.orgId}/snapshot`);
  return { orgId: created.body.orgId, code: snap.body.org.joinCode };
}

export async function join(client: Client, code: string, nickname = "Member"): Promise<void> {
  const res = await client.req("POST", "/api/join", { code, nickname });
  if (res.status !== 200) throw new Error(`join: ${res.status} ${JSON.stringify(res.body)}`);
}

type QuestionSpec = { kind: "open" } | { kind: "choice"; options: string[] };

/** Drafts a question and starts collection; returns its id, options and deadline. */
export async function startQuestion(
  host: Client,
  orgId: string,
  spec: QuestionSpec,
  durationSec = 5,
): Promise<{ questionId: string; options: { id: string; label: string }[]; deadline: number }> {
  const drafted = await host.req("POST", `/api/orgs/${orgId}/questions`, {
    kind: spec.kind,
    prompt: unique("prompt"),
    durationSec,
    options: spec.kind === "choice" ? spec.options : [],
  });
  if (drafted.status !== 201) throw new Error(`draft: ${drafted.status} ${JSON.stringify(drafted.body)}`);
  const started = await host.req("POST", `/api/questions/${drafted.body.questionId}/start`, {});
  if (started.status !== 200) throw new Error(`start: ${started.status} ${JSON.stringify(started.body)}`);
  const detail = await host.req("GET", `/api/questions/${drafted.body.questionId}`);
  return { questionId: drafted.body.questionId, options: detail.body.options, deadline: started.body.deadline };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits until the server clock is past `deadline` (plus a margin for the reveal timer). */
export async function waitPast(deadline: number, marginMs = 300): Promise<void> {
  await sleep(Math.max(0, deadline - Date.now() + marginMs));
}

/** Opens the event stream and returns a handle that resolves once a matching chunk arrives. */
export async function openEvents(client: Client, orgId: string) {
  const controller = new AbortController();
  const res = await fetch(new URL(`/api/orgs/${orgId}/events`, baseUrl), {
    headers: { ...proxyHeaders, cookie: client.cookieHeader },
    signal: controller.signal,
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  return {
    get text() {
      return text;
    },
    async waitFor(pattern: RegExp, timeoutMs: number): Promise<boolean> {
      const deadline = Date.now() + timeoutMs;
      while (!pattern.test(text)) {
        const left = deadline - Date.now();
        if (left <= 0) return false;
        const next = await Promise.race([reader.read(), sleep(left).then(() => null)]);
        if (next === null || next.done) return pattern.test(text);
        text += decoder.decode(next.value, { stream: true });
      }
      return true;
    },
    close: () => controller.abort(),
  };
}
