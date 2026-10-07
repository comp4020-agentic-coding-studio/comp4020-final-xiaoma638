import type { Snapshot } from "./types.ts";

export type Connection = "connecting" | "live" | "lost";

/**
 * Keeps an org snapshot current. The event stream only says "version N
 * exists"; this then fetches the authoritative snapshot, coalescing bursts
 * into one fetch at a time, and never lets an older snapshot replace a newer
 * one. On (re)connect it always refetches, so a dropped connection heals
 * without a reload.
 */
export class LiveOrg {
  snapshot = $state<Snapshot>() as Snapshot;
  connection = $state<Connection>("connecting");
  /** Server clock minus local clock, so the countdown follows the server's deadline. */
  clockOffset = $state(0);
  /** Set when the server says we're no longer a member (or the org is gone). */
  gone = $state(false);

  #source: EventSource | null = null;
  #streamOpen = false;
  #fetchController: AbortController | null = null;
  #again = false;
  #requiredVersion = 0;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #disconnect: (() => void) | null = null;

  constructor(initial: Snapshot) {
    this.apply(initial);
  }

  apply(next: Snapshot): void {
    if (this.snapshot && next.version < this.snapshot.version) return;
    this.snapshot = next;
    this.clockOffset = next.now - Date.now();
  }

  serverNow(): number {
    return Date.now() + this.clockOffset;
  }

  #clearRetry(): void {
    if (this.#retryTimer !== null) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
  }

  #retrySnapshot(): void {
    if (!this.#disconnect || this.gone || this.#retryTimer !== null) return;
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      void this.refresh();
    }, 3000);
  }

  async refresh(): Promise<void> {
    if (this.gone) return;
    if (this.#fetchController) {
      this.#again = true;
      return;
    }
    this.#clearRetry();
    const controller = new AbortController();
    this.#fetchController = controller;
    const current = () => this.#fetchController === controller;
    if (this.connection === "live") this.connection = "connecting";
    try {
      do {
        this.#again = false;
        const res = await fetch(`/api/orgs/${this.snapshot.org.id}/snapshot`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!current()) return;
        if (res.status === 404) {
          this.gone = true;
          this.connection = "lost";
          this.#disconnect?.();
          return;
        }
        if (!res.ok) throw new Error(`Snapshot request failed (${res.status})`);
        const next = await res.json() as Snapshot;
        if (!current()) return;
        this.apply(next);
        // An event can arrive while this snapshot is being fetched. Drain the
        // queued fetch before claiming to be caught up with the event stream.
        if (this.snapshot.version < this.#requiredVersion && !this.#again) {
          throw new Error("Snapshot has not caught up with the event stream");
        }
      } while (this.#again);
      if (this.#streamOpen) this.connection = "live";
    } catch {
      if (current()) {
        this.connection = "lost";
        // The SSE connection can stay open while snapshot requests fail, so
        // recovery must not depend on receiving another event or reconnect.
        this.#retrySnapshot();
      }
    } finally {
      if (current()) this.#fetchController = null;
    }
  }

  connect(): () => void {
    this.#disconnect?.();
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let detachSource = () => {};

    const clearReconnect = () => {
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };
    const reconnect = () => {
      if (reconnectTimer !== null) return;
      reconnectTimer = setTimeout(startSource, 3000);
    };
    const startSource = () => {
      clearReconnect();
      detachSource();
      if (this.#disconnect !== cleanup || this.gone) return;
      this.#streamOpen = false;
      this.connection = "connecting";
      let source: EventSource;
      try {
        source = new EventSource(`/api/orgs/${this.snapshot.org.id}/events`);
      } catch {
        this.connection = "lost";
        reconnect();
        return;
      }
      this.#source = source;
      const active = () => this.#source === source && this.#disconnect === cleanup;
      const opened = () => {
        if (!active()) return;
        this.#streamOpen = true;
        this.connection = "connecting";
        void this.refresh();
      };
      const changed = (event: Event) => {
        if (!active()) return;
        try {
          const { version } = JSON.parse((event as MessageEvent<string>).data) as { version: number };
          if (Number.isFinite(version)) this.#requiredVersion = Math.max(this.#requiredVersion, version);
        } catch {
          // A malformed notification cannot establish freshness; fetch the
          // authoritative state rather than treating its arrival as success.
          this.connection = "lost";
        }
        if (this.#requiredVersion > this.snapshot.version || this.connection !== "live") void this.refresh();
      };
      const failed = () => {
        if (!active()) return;
        this.#streamOpen = false;
        this.connection = "lost";
        // CONNECTING retries natively. CLOSED needs a replacement owned by
        // this same lifecycle, without accumulating online listeners.
        if (source.readyState === EventSource.CLOSED) reconnect();
      };
      source.addEventListener("open", opened);
      source.addEventListener("change", changed);
      source.addEventListener("error", failed);
      detachSource = () => {
        source.removeEventListener("open", opened);
        source.removeEventListener("change", changed);
        source.removeEventListener("error", failed);
        source.close();
        if (this.#source === source) this.#source = null;
      };
    };
    const online = () => {
      if (this.gone) return;
      if (this.#source?.readyState !== EventSource.OPEN) startSource();
      else void this.refresh();
    };
    const cleanup = () => {
      if (this.#disconnect !== cleanup) return;
      this.#disconnect = null;
      window.removeEventListener("online", online);
      clearReconnect();
      this.#clearRetry();
      detachSource();
      this.#streamOpen = false;
      this.#fetchController?.abort();
      this.#fetchController = null;
      this.#again = false;
      this.connection = "lost";
    };
    this.#disconnect = cleanup;
    window.addEventListener("online", online);
    startSource();
    return cleanup;
  }
}

/** JSON request helper: resolves to the parsed body, or throws an ApiError with the server's message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      // always JSON, even when empty: the server refuses other writes (CSRF defence)
      headers: { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(0, "network", "Couldn't reach the server. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, String(data.error ?? "error"), String(data.message ?? `Request failed (${res.status}).`), data);
  }
  return data as T;
}
