// In-process change notifications, one channel per organization. It carries
// only the org's new version number, never content: subscribers fetch a
// snapshot that is filtered for whoever is asking. Rebuildable by design,
// since the database is the source of truth.

type Listener = (version: number) => void;

const channels = new Map<string, Set<Listener>>();

export function subscribe(orgId: string, listener: Listener): () => void {
  let set = channels.get(orgId);
  if (!set) channels.set(orgId, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) channels.delete(orgId);
  };
}

export function publish(orgId: string, version: number): void {
  for (const listener of channels.get(orgId) ?? []) listener(version);
}

export function subscriberCount(orgId: string): number {
  return channels.get(orgId)?.size ?? 0;
}

// Open live connections, so shutdown can end them instead of waiting them out.
const connections = new Set<() => void>();

export function trackConnection(close: () => void): () => void {
  connections.add(close);
  return () => connections.delete(close);
}

export function closeAllConnections(): void {
  for (const close of [...connections]) close();
}

// Development reloads replace this module's subscriber map. End streams tied
// to the old map so browsers reconnect to the current notifications.
if (import.meta.hot) import.meta.hot.dispose(closeAllConnections);
