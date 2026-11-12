export const ROOT_ID = "root";
export const TRASH_ID = "trash";
export const HOME_ID = "home-user";
export const DESKTOP_ID = "home-desktop";
export const DOCUMENTS_ID = "home-documents";
export const DOWNLOADS_ID = "home-downloads";
export const PICTURES_ID = "home-pictures";
export const NOTES_ID = "home-notes";

export const MAX_NAME_LENGTH = 120;
/** Largest single file that can be imported into the virtual filesystem. */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export type NodeKind = "file" | "dir";

/**
 * One file or folder in the virtual filesystem. This lives entirely inside the
 * browser's own storage (IndexedDB); it is not the user's real file system.
 */
export interface FsNode {
  id: string;
  parentId: string | null;
  name: string;
  kind: NodeKind;
  mime: string;
  size: number;
  createdAt: number;
  modifiedAt: number;
  /** File contents: a string for text files, a Blob for everything else. */
  data?: string | Blob;
  /** Set on the top item of a deleted subtree (its parent is the trash). */
  trash?: { from: string; at: number };
  /** Built-in folders cannot be renamed, moved or deleted. */
  system?: boolean;
}

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });

/** Persistence backend for the filesystem. */
export interface FsAdapter {
  loadAll(): Promise<unknown[]>;
  apply(change: { put: FsNode[]; remove: string[] }): Promise<void>;
  getMeta(key: string): Promise<unknown>;
  setMeta(key: string, value: unknown): Promise<void>;
  /** Wipe everything (used by "erase all data"). */
  clear(): Promise<void>;
}
