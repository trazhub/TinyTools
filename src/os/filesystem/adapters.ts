import type { FsAdapter, FsNode } from "./types";

/** Keeps everything in memory. Used in tests and as a fallback when IndexedDB is unavailable. */
export function createMemoryAdapter(initial: FsNode[] = []): FsAdapter & { nodes: Map<string, FsNode>; meta: Map<string, unknown> } {
  const nodes = new Map(initial.map((n) => [n.id, n]));
  const meta = new Map<string, unknown>();
  return {
    nodes,
    meta,
    loadAll: async () => [...nodes.values()],
    async apply({ put, remove }) {
      for (const n of put) nodes.set(n.id, n);
      for (const id of remove) nodes.delete(id);
    },
    getMeta: async (key) => meta.get(key),
    setMeta: async (key, value) => void meta.set(key, value),
    async clear() {
      nodes.clear();
      meta.clear();
    },
  };
}

const DB_NAME = "tinytools-os";
const DB_VERSION = 1;
const NODES = "nodes";
const META = "meta";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

/**
 * Open (and upgrade, if needed) the database. Upgrades are additive:
 * add a `case` for each new version and never remove an older one.
 */
export function openDatabase(factory: IDBFactory = indexedDB, name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) {
        db.createObjectStore(NODES, { keyPath: "id" });
        db.createObjectStore(META, { keyPath: "key" });
      }
      // Future versions: add `if (event.oldVersion < 2) { ... }` blocks here, never edit the ones above.
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open IndexedDB"));
    req.onblocked = () => reject(new Error("IndexedDB is blocked by another tab"));
  });
}

export function createIndexedDbAdapter(db: IDBDatabase): FsAdapter {
  return {
    async loadAll() {
      const tx = db.transaction(NODES, "readonly");
      return request(tx.objectStore(NODES).getAll());
    },
    async apply({ put, remove }) {
      if (put.length === 0 && remove.length === 0) return;
      const tx = db.transaction(NODES, "readwrite");
      const store = tx.objectStore(NODES);
      for (const node of put) store.put(node);
      for (const id of remove) store.delete(id);
      await done(tx);
    },
    async getMeta(key) {
      const tx = db.transaction(META, "readonly");
      const row = (await request(tx.objectStore(META).get(key))) as { key: string; value: unknown } | undefined;
      return row?.value;
    },
    async setMeta(key, value) {
      const tx = db.transaction(META, "readwrite");
      tx.objectStore(META).put({ key, value });
      await done(tx);
    },
    async clear() {
      const tx = db.transaction([NODES, META], "readwrite");
      tx.objectStore(NODES).clear();
      tx.objectStore(META).clear();
      await done(tx);
    },
  };
}

export type FsOpenOutcome = { adapter: FsAdapter; persistent: boolean; warning?: string };

/** Use IndexedDB when it works, otherwise fall back to memory with a clear warning. */
export async function openBestAdapter(): Promise<FsOpenOutcome> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("IndexedDB is not available");
    const db = await openDatabase();
    return { adapter: createIndexedDbAdapter(db), persistent: true };
  } catch (e) {
    return {
      adapter: createMemoryAdapter(),
      persistent: false,
      warning: `Your browser isn't allowing TinyTools OS to save files (${e instanceof Error ? e.message : "storage unavailable"}). Files will be lost when you close this tab.`,
    };
  }
}
