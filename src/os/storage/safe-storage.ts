/**
 * Thin wrappers over localStorage / sessionStorage that never throw. Storage can
 * be unavailable (privacy modes, blocked cookies, quota), and persisted data can
 * be corrupt, so every read is defensive and every write reports success.
 */

type Kind = "local" | "session";

function area(kind: Kind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson(kind: Kind, key: string): unknown {
  try {
    const raw = area(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

export function writeJson(kind: Kind, key: string, value: unknown): boolean {
  try {
    const store = area(kind);
    if (!store) return false;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(kind: Kind, key: string): void {
  try {
    area(kind)?.removeItem(key);
  } catch {
    // ignore
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
