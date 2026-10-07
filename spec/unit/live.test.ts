import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveOrg } from "../../src/lib/live.svelte.ts";
import type { Snapshot } from "../../src/lib/types.ts";

class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = FakeEventSource.CONNECTING;
  close = vi.fn(() => { this.readyState = FakeEventSource.CLOSED; });

  constructor(readonly url: string) {
    super();
    FakeEventSource.instances.push(this);
  }

  open() {
    this.readyState = FakeEventSource.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  change(version: number) {
    this.dispatchEvent(new MessageEvent("change", { data: JSON.stringify({ version }) }));
  }

  fail(closed = false) {
    this.readyState = closed ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING;
    this.dispatchEvent(new Event("error"));
  }
}

function snapshot(version = 1): Snapshot {
  return {
    version,
    now: Date.now(),
    org: { id: "org-1", name: "Test", joinCode: "ABC123", memberCount: 1 },
    me: { id: "member-1", nickname: "Alice", isHost: true },
    current: null,
    history: [],
  };
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("live snapshot recovery", () => {
  let live: LiveOrg;
  let cleanup: () => void;
  let browser: EventTarget;
  const request = vi.fn<typeof fetch>();
  const settle = () => vi.advanceTimersByTimeAsync(0);
  const source = () => FakeEventSource.instances.at(-1)!;

  beforeEach(() => {
    vi.useFakeTimers();
    // Exercise the controller without a component: these tests cover network
    // state and resource ownership, rather than Svelte's rune implementation.
    vi.stubGlobal("$state", <T>(value: T) => value);
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", request);
    browser = new EventTarget();
    vi.stubGlobal("window", browser);
    FakeEventSource.instances = [];
    request.mockReset();
    live = new LiveOrg(snapshot());
    cleanup = live.connect();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("waits for the authoritative snapshot before claiming the stream is live", async () => {
    const pending = deferredResponse();
    request.mockReturnValueOnce(pending.promise);
    source().open();
    expect(live.connection).toBe("connecting");
    pending.resolve(Response.json(snapshot(2)));
    await settle();
    expect(live.snapshot.version).toBe(2);
    expect(live.connection).toBe("live");
  });

  it("retries failed snapshots even when the event stream stays open", async () => {
    request.mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(snapshot(2)));
    source().open();
    await settle();
    expect(live.connection).toBe("lost");
    expect(live.snapshot.version).toBe(1);
    source().change(2);
    await settle();
    expect(live.connection).toBe("lost");
    await vi.advanceTimersByTimeAsync(3000);
    expect(request).toHaveBeenCalledTimes(3);
    expect(live.snapshot.version).toBe(2);
    expect(live.connection).toBe("live");
  });

  it("waits until a snapshot includes changes received during an earlier fetch", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    request.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    source().open();
    source().change(3);
    first.resolve(Response.json(snapshot(2)));
    await settle();
    expect(live.connection).not.toBe("live");
    expect(request).toHaveBeenCalledTimes(2);
    second.resolve(Response.json(snapshot(3)));
    await settle();
    expect(live.snapshot.version).toBe(3);
    expect(live.connection).toBe("live");
  });

  it("withdraws live status on a failed update and never accepts an older snapshot", async () => {
    request.mockResolvedValueOnce(Response.json(snapshot(3)))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(Response.json(snapshot(2)))
      .mockResolvedValueOnce(Response.json(snapshot(4)));
    source().open();
    await settle();
    expect(live.connection).toBe("live");
    source().change(4);
    await settle();
    expect(live.connection).toBe("lost");
    await vi.advanceTimersByTimeAsync(3000);
    expect(live.snapshot.version).toBe(3);
    expect(live.connection).toBe("lost");
    await vi.advanceTimersByTimeAsync(3000);
    expect(live.snapshot.version).toBe(4);
    expect(live.connection).toBe("live");
  });

  it("does not treat a completed snapshot as a recovered event stream", async () => {
    const pending = deferredResponse();
    request.mockReturnValueOnce(pending.promise);
    source().open();
    source().fail();
    pending.resolve(Response.json(snapshot(2)));
    await settle();
    expect(live.snapshot.version).toBe(2);
    expect(live.connection).toBe("lost");
  });

  it("recovers immediately on online and cancels its pending snapshot retry", async () => {
    request.mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(Response.json(snapshot(2)));
    source().open();
    await settle();
    browser.dispatchEvent(new Event("online"));
    await settle();
    expect(live.connection).toBe("live");
    await vi.advanceTimersByTimeAsync(3000);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("replaces a closed stream immediately on online without another timed reconnect", async () => {
    const first = source();
    first.fail(true);
    browser.dispatchEvent(new Event("online"));
    expect(source()).not.toBe(first);
    request.mockResolvedValueOnce(Response.json(snapshot(2)));
    source().open();
    await settle();
    expect(live.connection).toBe("live");
    await vi.advanceTimersByTimeAsync(3000);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("owns every replacement stream and removes retries and online listeners on cleanup", async () => {
    const first = source();
    first.fail(true);
    await vi.advanceTimersByTimeAsync(3000);
    const replacement = source();
    expect(replacement).not.toBe(first);
    expect(first.close).toHaveBeenCalled();
    request.mockRejectedValue(new TypeError("offline"));
    replacement.open();
    await settle();
    replacement.fail(true);
    cleanup();
    const requestCount = request.mock.calls.length;
    browser.dispatchEvent(new Event("online"));
    first.open();
    await vi.advanceTimersByTimeAsync(9000);
    expect(replacement.close).toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(request).toHaveBeenCalledTimes(requestCount);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores an old in-flight response after a replacement connection and its old cleanup", async () => {
    const pending = deferredResponse();
    request.mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(Response.json(snapshot(2)));
    source().open();
    const signal = request.mock.calls[0][1]?.signal;
    const oldCleanup = cleanup;
    cleanup = live.connect();
    expect(signal?.aborted).toBe(true);
    oldCleanup();
    source().open();
    await settle();
    pending.resolve(Response.json(snapshot(99)));
    await settle();
    expect(live.snapshot.version).toBe(2);
    expect(live.connection).toBe("live");
  });

  it("stops reconnecting when the snapshot confirms membership is gone", async () => {
    request.mockResolvedValueOnce(new Response(null, { status: 404 }));
    source().open();
    await settle();
    expect(live.gone).toBe(true);
    expect(live.connection).toBe("lost");
    expect(source().close).toHaveBeenCalled();
    browser.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(9000);
    expect(request).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
