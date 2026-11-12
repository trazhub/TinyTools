import { isRecord, readJson, removeKey, writeJson } from "../storage/safe-storage";
import type { Rect, Size } from "./geometry";
import type { WindowStore } from "./store";
import type { WMAction, WindowState } from "./types";

const KEY = "tinytools-os:session";
const VERSION = 1;

/** What the registry must tell the session about each app when restoring it. */
export interface AppInfo {
  minSize: Size;
  resizable: boolean;
}
export type AppLookup = (appId: string) => AppInfo | undefined;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function parseRect(v: unknown): Rect | null {
  if (!isRecord(v)) return null;
  const { x, y, width, height } = v;
  if (![x, y, width, height].every(isFiniteNumber)) return null;
  if ((width as number) < 50 || (height as number) < 50) return null;
  return { x: x as number, y: y as number, width: width as number, height: height as number };
}

/** Validate persisted data; anything malformed or from an unknown app is silently dropped. */
export function parseSession(raw: unknown, lookup: AppLookup): Extract<WMAction, { type: "hydrate" }>["state"] | null {
  if (!isRecord(raw) || raw.version !== VERSION || !Array.isArray(raw.windows)) return null;

  const windows: WindowState[] = [];
  const seen = new Set<string>();
  for (const item of raw.windows) {
    if (!isRecord(item)) continue;
    const { id, appId, title, z } = item;
    if (typeof id !== "string" || typeof appId !== "string" || typeof title !== "string" || !isFiniteNumber(z)) continue;
    if (seen.has(id)) continue;
    const info = lookup(appId);
    const rect = parseRect(item.rect);
    if (!info || !rect) continue;
    seen.add(id);
    windows.push({
      id,
      appId,
      title: title.slice(0, 200),
      rect,
      minimized: item.minimized === true,
      maximized: item.maximized === true && info.resizable,
      z,
      minSize: info.minSize,
      resizable: info.resizable,
      props: isRecord(item.props) ? item.props : {},
    });
  }

  const lastBounds: Record<string, Rect> = {};
  if (isRecord(raw.lastBounds)) {
    for (const [appId, value] of Object.entries(raw.lastBounds)) {
      const rect = parseRect(value);
      if (rect && lookup(appId)) lastBounds[appId] = rect;
    }
  }

  const maxZ = windows.reduce((m, w) => Math.max(m, w.z), 0);
  const maxId = windows.reduce((m, w) => Math.max(m, Number(w.id.replace(/\D/g, "")) || 0), 0);
  const focusedId = typeof raw.focusedId === "string" && seen.has(raw.focusedId) ? raw.focusedId : null;
  return { windows, focusedId, lastBounds, nextZ: maxZ + 1, nextId: Math.max(maxId + 1, 1) };
}

export function loadSession(store: WindowStore, lookup: AppLookup): number {
  const parsed = parseSession(readJson("session", KEY), lookup);
  if (!parsed || parsed.windows.length === 0) return 0;
  store.dispatch({ type: "hydrate", state: parsed });
  return parsed.windows.length;
}

export function clearSession(): void {
  removeKey("session", KEY);
}

/** Save the window layout (debounced) for the lifetime of this browser tab. Returns an unsubscribe function. */
export function persistSession(store: WindowStore, delayMs = 250): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    const { windows, focusedId, lastBounds } = store.getState();
    writeJson("session", KEY, { version: VERSION, windows, focusedId, lastBounds });
  };
  const unsubscribe = store.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(save, delayMs);
  });
  return () => {
    unsubscribe();
    clearTimeout(timer);
    save();
  };
}
