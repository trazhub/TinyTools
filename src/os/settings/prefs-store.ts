import { readJson, removeKey, writeJson } from "../storage/safe-storage";
import { DEFAULT_PREFS, PREFS_KEY, PREFS_VERSION, sanitizePrefs, type Prefs } from "./prefs";

/**
 * Preferences live in localStorage (small, synchronous, available before the
 * filesystem finishes loading, so the theme is right from the first paint).
 */
export interface PrefsStore {
  get(): Prefs;
  set(patch: Partial<Prefs> | ((current: Prefs) => Partial<Prefs>)): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

export function createPrefsStore(): PrefsStore {
  let current: Prefs = sanitizePrefs(readJson("local", PREFS_KEY));
  const listeners = new Set<() => void>();

  const commit = (next: Prefs) => {
    current = next;
    writeJson("local", PREFS_KEY, { version: PREFS_VERSION, prefs: current });
    listeners.forEach((l) => l());
  };

  return {
    get: () => current,
    set(patch) {
      const change = typeof patch === "function" ? patch(current) : patch;
      commit(sanitizePrefs({ ...current, ...change }));
    },
    reset() {
      removeKey("local", PREFS_KEY);
      current = DEFAULT_PREFS;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** True when nothing has ever been saved, i.e. this is the first visit. */
export function isFirstRun(): boolean {
  return readJson("local", PREFS_KEY) === undefined;
}
