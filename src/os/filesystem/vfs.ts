import { isRecord } from "../storage/safe-storage";
import { isTextMime, mimeFromName } from "./mime";
import { compareNames, dedupeName, validateName } from "./names";
import {
  DESKTOP_ID,
  DOCUMENTS_ID,
  DOWNLOADS_ID,
  HOME_ID,
  MAX_IMPORT_BYTES,
  NOTES_ID,
  PICTURES_ID,
  ROOT_ID,
  TRASH_ID,
  fail,
  ok,
  type FsAdapter,
  type FsNode,
  type Result,
} from "./types";

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;

/** Check that something loaded from storage really is a filesystem node. */
function toNode(raw: unknown): FsNode | null {
  if (!isRecord(raw)) return null;
  const { id, parentId, name, kind, mime, size, createdAt, modifiedAt, data, trash, system } = raw;
  if (typeof id !== "string" || typeof name !== "string" || (kind !== "file" && kind !== "dir")) return null;
  if (!(parentId === null || typeof parentId === "string")) return null;
  const node: FsNode = {
    id,
    parentId,
    name,
    kind,
    mime: typeof mime === "string" ? mime : kind === "dir" ? "inode/directory" : mimeFromName(name),
    size: typeof size === "number" && Number.isFinite(size) ? size : 0,
    createdAt: typeof createdAt === "number" ? createdAt : Date.now(),
    modifiedAt: typeof modifiedAt === "number" ? modifiedAt : Date.now(),
  };
  if (kind === "file") {
    node.data = typeof data === "string" || data instanceof Blob ? data : "";
  }
  if (isRecord(trash) && typeof trash.from === "string" && typeof trash.at === "number") {
    node.trash = { from: trash.from, at: trash.at };
  }
  if (system === true) node.system = true;
  return node;
}

export interface SearchHit {
  node: FsNode;
  path: string;
}

export class VirtualFileSystem {
  private nodes = new Map<string, FsNode>();
  private kids = new Map<string, Set<string>>();
  private listeners = new Set<() => void>();
  private version = 0;
  private queue: Promise<void> = Promise.resolve();

  /** Called when saving to storage fails (for example because the quota is full). */
  onPersistError: ((error: unknown) => void) | undefined;

  private constructor(
    private readonly adapter: FsAdapter,
    /** False when storage was unavailable and files will vanish when the tab closes. */
    readonly persistent: boolean,
  ) {}

  /** Load the filesystem from `adapter`, repairing damage and creating the default folders on first run. */
  static async open(adapter: FsAdapter, options: { persistent?: boolean } = {}): Promise<VirtualFileSystem> {
    const fs = new VirtualFileSystem(adapter, options.persistent ?? true);
    fs.ingest(await adapter.loadAll());
    if (!(await adapter.getMeta("seeded"))) {
      if (!fs.nodes.has(HOME_ID)) fs.seed();
      await fs.flush();
      await adapter.setMeta("seeded", true);
    }
    return fs;
  }

  // ---- subscription ------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  /** Resolves once everything queued so far has been written to storage. */
  flush(): Promise<void> {
    return this.queue;
  }

  // ---- loading -----------------------------------------------------------

  private ingest(raw: unknown[]): void {
    for (const item of raw) {
      const node = toNode(item);
      if (node) this.nodes.set(node.id, node);
    }
    const fixes: FsNode[] = [];
    const ensure = (id: string, name: string, parentId: string | null) => {
      if (this.nodes.has(id)) return;
      const now = Date.now();
      const node: FsNode = { id, parentId, name, kind: "dir", mime: "inode/directory", size: 0, createdAt: now, modifiedAt: now, system: true };
      this.nodes.set(id, node);
      fixes.push(node);
    };
    ensure(ROOT_ID, "", null);
    ensure(TRASH_ID, ".trash", ROOT_ID);

    // Reattach nodes whose parent is missing, not a folder, or part of a loop.
    for (const node of this.nodes.values()) {
      if (node.id === ROOT_ID) continue;
      const fallback = this.nodes.has(HOME_ID) ? HOME_ID : ROOT_ID;
      const parent = node.parentId ? this.nodes.get(node.parentId) : undefined;
      let broken = !parent || parent.kind !== "dir" || node.id === node.parentId;
      if (!broken) {
        const seen = new Set<string>([node.id]);
        for (let cur: FsNode | undefined = parent; cur; cur = cur.parentId ? this.nodes.get(cur.parentId) : undefined) {
          if (seen.has(cur.id)) {
            broken = true;
            break;
          }
          seen.add(cur.id);
        }
      }
      if (broken) {
        node.parentId = fallback;
        delete node.trash;
        fixes.push(node);
      }
    }

    for (const node of this.nodes.values()) this.link(node);
    if (fixes.length) this.persist(fixes, []);
  }

  private seed(): void {
    const now = Date.now();
    const dir = (id: string, name: string, parentId: string, system = true) => {
      const node: FsNode = { id, parentId, name, kind: "dir", mime: "inode/directory", size: 0, createdAt: now, modifiedAt: now, system };
      this.nodes.set(id, node);
      this.link(node);
      return node;
    };
    const put = [
      dir("home", "home", ROOT_ID),
      dir(HOME_ID, "user", "home"),
      dir(DESKTOP_ID, "Desktop", HOME_ID),
      dir(DOCUMENTS_ID, "Documents", HOME_ID),
      dir(DOWNLOADS_ID, "Downloads", HOME_ID),
      dir(PICTURES_ID, "Pictures", HOME_ID),
      dir(NOTES_ID, "Notes", HOME_ID),
    ];
    const file = (parentId: string, name: string, text: string) => {
      const node: FsNode = {
        id: newId(),
        parentId,
        name,
        kind: "file",
        mime: mimeFromName(name),
        size: byteLength(text),
        createdAt: now,
        modifiedAt: now,
        data: text,
      };
      this.nodes.set(node.id, node);
      this.link(node);
      put.push(node);
    };
    file(NOTES_ID, "Welcome to TinyTools OS.md", WELCOME_NOTE);
    file(DOCUMENTS_ID, "About this computer.txt", ABOUT_TEXT);
    this.persist(put, []);
  }

  // ---- indexing ----------------------------------------------------------

  private link(node: FsNode): void {
    if (!node.parentId) return;
    let set = this.kids.get(node.parentId);
    if (!set) this.kids.set(node.parentId, (set = new Set()));
    set.add(node.id);
  }

  private unlink(node: FsNode): void {
    if (node.parentId) this.kids.get(node.parentId)?.delete(node.id);
  }

  private persist(put: FsNode[], remove: string[]): void {
    this.version++;
    this.listeners.forEach((l) => l());
    this.queue = this.queue
      .then(() => this.adapter.apply({ put, remove }))
      .catch((error: unknown) => this.onPersistError?.(error));
  }

  // ---- queries -----------------------------------------------------------

  get(id: string): FsNode | undefined {
    return this.nodes.get(id);
  }

  exists(id: string): boolean {
    return this.nodes.has(id);
  }

  parent(id: string): FsNode | undefined {
    const parentId = this.nodes.get(id)?.parentId;
    return parentId ? this.nodes.get(parentId) : undefined;
  }

  /** Children of a folder: folders first, then natural name order. Dotfiles are hidden unless asked for. */
  list(dirId: string, options: { hidden?: boolean } = {}): FsNode[] {
    const out: FsNode[] = [];
    for (const id of this.kids.get(dirId) ?? []) {
      const node = this.nodes.get(id);
      if (node && (options.hidden || !node.name.startsWith("."))) out.push(node);
    }
    return out.sort((a, b) => (a.kind === b.kind ? compareNames(a.name, b.name) : a.kind === "dir" ? -1 : 1));
  }

  findChild(dirId: string, name: string): FsNode | undefined {
    let loose: FsNode | undefined;
    const lower = name.toLowerCase();
    for (const id of this.kids.get(dirId) ?? []) {
      const node = this.nodes.get(id);
      if (!node) continue;
      if (node.name === name) return node;
      if (node.name.toLowerCase() === lower) loose ??= node;
    }
    return loose;
  }

  /** The absolute path of a node, e.g. "/home/user/Documents". */
  pathOf(id: string): string {
    const parts: string[] = [];
    for (let cur = this.nodes.get(id); cur && cur.id !== ROOT_ID; cur = cur.parentId ? this.nodes.get(cur.parentId) : undefined) {
      parts.unshift(cur.name);
      if (parts.length > 64) break;
    }
    return "/" + parts.join("/");
  }

  /** Resolve "/abs", "rel/path", "~", "..", "." relative to `cwdId`. */
  resolve(path: string, cwdId: string = HOME_ID): FsNode | undefined {
    let cur: string = path.startsWith("/") ? ROOT_ID : cwdId;
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "~") {
      cur = HOME_ID;
      parts.shift();
    }
    for (const part of parts) {
      if (part === ".") continue;
      if (part === "..") {
        cur = this.nodes.get(cur)?.parentId ?? cur;
        continue;
      }
      const child = this.findChild(cur, part);
      if (!child) return undefined;
      cur = child.id;
    }
    return this.nodes.get(cur);
  }

  isInTrash(id: string): boolean {
    for (let cur = this.nodes.get(id); cur; cur = cur.parentId ? this.nodes.get(cur.parentId) : undefined) {
      if (cur.id === TRASH_ID) return true;
    }
    return false;
  }

  isDescendant(id: string, ancestorId: string): boolean {
    for (let cur = this.nodes.get(id); cur; cur = cur.parentId ? this.nodes.get(cur.parentId) : undefined) {
      if (cur.id === ancestorId) return true;
    }
    return false;
  }

  private descendants(id: string): FsNode[] {
    const out: FsNode[] = [];
    const stack = [id];
    while (stack.length) {
      for (const childId of this.kids.get(stack.pop()!) ?? []) {
        const child = this.nodes.get(childId);
        if (!child) continue;
        out.push(child);
        if (child.kind === "dir") stack.push(child.id);
      }
    }
    return out;
  }

  /** Case-insensitive name search below `rootId` (the trash is skipped unless it is the root). */
  search(query: string, rootId: string = ROOT_ID): SearchHit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.descendants(rootId)
      .filter((n) => n.name.toLowerCase().includes(q) && (rootId === TRASH_ID || !this.isInTrash(n.id)))
      .sort((a, b) => compareNames(a.name, b.name))
      .map((node) => ({ node, path: this.pathOf(node.id) }));
  }

  /** Bytes used by all files (including the trash). */
  usage(): number {
    let total = 0;
    for (const n of this.nodes.values()) if (n.kind === "file") total += n.size;
    return total;
  }

  trashCount(): number {
    return this.kids.get(TRASH_ID)?.size ?? 0;
  }

  uniqueName(parentId: string, name: string): string {
    return dedupeName(name, (candidate) => this.findChild(parentId, candidate) !== undefined);
  }

  // ---- mutations ---------------------------------------------------------

  private checkParent(parentId: string): Result<FsNode> {
    const parent = this.nodes.get(parentId);
    if (!parent) return fail("That folder no longer exists.");
    if (parent.kind !== "dir") return fail(`"${parent.name}" is not a folder.`);
    if (this.isInTrash(parentId)) return fail("You can't add items to the trash. Restore the folder first.");
    return ok(parent);
  }

  private checkName(parentId: string, rawName: string, ignoreId?: string): Result<string> {
    const name = validateName(rawName);
    if (!name.ok) return name;
    const clash = this.findChild(parentId, name.value);
    if (clash && clash.id !== ignoreId) {
      return fail(`A ${clash.kind === "dir" ? "folder" : "file"} named "${clash.name}" already exists here.`);
    }
    return name;
  }

  mkdir(parentId: string, rawName: string): Result<FsNode> {
    const parent = this.checkParent(parentId);
    if (!parent.ok) return parent;
    const name = this.checkName(parentId, rawName);
    if (!name.ok) return name;
    const now = Date.now();
    const node: FsNode = { id: newId(), parentId, name: name.value, kind: "dir", mime: "inode/directory", size: 0, createdAt: now, modifiedAt: now };
    this.nodes.set(node.id, node);
    this.link(node);
    this.persist([node], []);
    return ok(node);
  }

  /** Create a folder and any missing parents, like `mkdir -p`. */
  mkdirp(path: string, cwdId: string = HOME_ID): Result<FsNode> {
    let cur: string = path.startsWith("/") ? ROOT_ID : cwdId;
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "~") {
      cur = HOME_ID;
      parts.shift();
    }
    for (const part of parts) {
      if (part === ".") continue;
      if (part === "..") {
        cur = this.nodes.get(cur)?.parentId ?? cur;
        continue;
      }
      const existing = this.findChild(cur, part);
      if (existing) {
        if (existing.kind !== "dir") return fail(`"${existing.name}" exists and is not a folder.`);
        cur = existing.id;
        continue;
      }
      const made = this.mkdir(cur, part);
      if (!made.ok) return made;
      cur = made.value.id;
    }
    return ok(this.nodes.get(cur)!);
  }

  createFile(parentId: string, rawName: string, data: string | Blob = "", mime?: string): Result<FsNode> {
    const parent = this.checkParent(parentId);
    if (!parent.ok) return parent;
    const name = this.checkName(parentId, rawName);
    if (!name.ok) return name;
    const type = mime ?? mimeFromName(name.value);
    if (typeof data !== "string" && isTextMime(type)) return fail("Text files must be created from text.");
    const now = Date.now();
    const node: FsNode = {
      id: newId(),
      parentId,
      name: name.value,
      kind: "file",
      mime: type,
      size: typeof data === "string" ? byteLength(data) : data.size,
      createdAt: now,
      modifiedAt: now,
      data,
    };
    this.nodes.set(node.id, node);
    this.link(node);
    this.persist([node], []);
    return ok(node);
  }

  /** Import a file chosen by the user from their computer into a folder. Names are made unique automatically. */
  async importFile(parentId: string, file: File): Promise<Result<FsNode>> {
    if (file.size > MAX_IMPORT_BYTES) {
      return fail(`"${file.name}" is larger than the ${MAX_IMPORT_BYTES / 1024 / 1024} MB import limit.`);
    }
    const checked = validateName(file.name || "Imported file");
    const name = checked.ok ? checked.value : "Imported file";
    const mime = mimeFromName(name);
    let data: string | Blob;
    try {
      data = isTextMime(mime) ? await file.text() : file;
    } catch {
      return fail(`"${file.name}" could not be read.`);
    }
    const parent = this.checkParent(parentId);
    if (!parent.ok) return parent;
    return this.createFile(parentId, this.uniqueName(parentId, name), data, mime);
  }

  /** Replace the contents of a text file. */
  writeText(id: string, text: string): Result<FsNode> {
    const node = this.nodes.get(id);
    if (!node || node.kind !== "file") return fail("That file no longer exists.");
    if (this.isInTrash(id)) return fail("This file is in the trash.");
    if (typeof node.data !== "string" && node.data !== undefined) return fail(`"${node.name}" is a binary file and can't be edited as text.`);
    const next: FsNode = { ...node, data: text, size: byteLength(text), modifiedAt: Date.now() };
    this.nodes.set(id, next);
    this.persist([next], []);
    return ok(next);
  }

  /** Synchronous text read; binary files report an error. */
  readText(id: string): Result<string> {
    const node = this.nodes.get(id);
    if (!node) return fail("No such file.");
    if (node.kind === "dir") return fail(`"${node.name}" is a folder.`);
    if (typeof node.data === "string") return ok(node.data);
    if (node.data === undefined) return ok("");
    return fail(`"${node.name}" is a binary file.`);
  }

  readBlob(id: string): Blob | undefined {
    const node = this.nodes.get(id);
    if (!node || node.kind !== "file" || node.data === undefined) return undefined;
    return typeof node.data === "string" ? new Blob([node.data], { type: node.mime }) : node.data;
  }

  rename(id: string, rawName: string): Result<FsNode> {
    const node = this.nodes.get(id);
    if (!node || !node.parentId) return fail("That item no longer exists.");
    if (node.system) return fail(`"${node.name}" is a built-in folder and can't be renamed.`);
    const name = this.checkName(node.parentId, rawName, id);
    if (!name.ok) return name;
    if (name.value === node.name) return ok(node);
    const next: FsNode = { ...node, name: name.value, modifiedAt: Date.now() };
    if (node.kind === "file" && node.mime === "application/octet-stream") next.mime = mimeFromName(name.value);
    this.nodes.set(id, next);
    this.persist([next], []);
    return ok(next);
  }

  move(id: string, newParentId: string): Result<FsNode> {
    const node = this.nodes.get(id);
    if (!node || !node.parentId) return fail("That item no longer exists.");
    if (node.system) return fail(`"${node.name}" is a built-in folder and can't be moved.`);
    const parent = this.checkParent(newParentId);
    if (!parent.ok) return parent;
    if (this.isDescendant(newParentId, id)) return fail("A folder can't be moved into itself.");
    if (node.parentId === newParentId) return ok(node);
    const name = this.checkName(newParentId, node.name, id);
    if (!name.ok) return name;
    this.unlink(node);
    const next: FsNode = { ...node, parentId: newParentId, modifiedAt: Date.now() };
    delete next.trash;
    this.nodes.set(id, next);
    this.link(next);
    this.persist([next], []);
    return ok(next);
  }

  /** Copy a file or folder (recursively) into `newParentId`, renaming on conflict. */
  copy(id: string, newParentId: string): Result<FsNode> {
    const source = this.nodes.get(id);
    if (!source) return fail("That item no longer exists.");
    const parent = this.checkParent(newParentId);
    if (!parent.ok) return parent;
    if (source.kind === "dir" && this.isDescendant(newParentId, id)) return fail("A folder can't be copied into itself.");

    const created: FsNode[] = [];
    const now = Date.now();
    const clone = (node: FsNode, parentId: string, name: string): FsNode => {
      const copy: FsNode = { ...node, id: newId(), parentId, name, createdAt: now, modifiedAt: now };
      delete copy.trash;
      delete copy.system;
      this.nodes.set(copy.id, copy);
      this.link(copy);
      created.push(copy);
      if (node.kind === "dir") {
        for (const child of this.list(node.id, { hidden: true })) clone(child, copy.id, child.name);
      }
      return copy;
    };
    const root = clone(source, newParentId, this.uniqueName(newParentId, source.name));
    this.persist(created, []);
    return ok(root);
  }

  /** Move to the trash (recoverable). */
  trash(id: string): Result<FsNode> {
    const node = this.nodes.get(id);
    if (!node || !node.parentId) return fail("That item no longer exists.");
    if (node.system) return fail(`"${node.name}" is a built-in folder and can't be deleted.`);
    if (this.isInTrash(id)) return fail("That item is already in the trash.");
    this.unlink(node);
    const next: FsNode = {
      ...node,
      parentId: TRASH_ID,
      name: this.uniqueName(TRASH_ID, node.name),
      trash: { from: node.parentId, at: Date.now() },
    };
    this.nodes.set(id, next);
    this.link(next);
    this.persist([next], []);
    return ok(next);
  }

  /** Put a trashed item back where it came from (or in Home if that folder is gone). */
  restore(id: string): Result<FsNode> {
    const node = this.nodes.get(id);
    if (!node || node.parentId !== TRASH_ID) return fail("That item isn't in the trash.");
    const from = node.trash?.from;
    const original = from ? this.nodes.get(from) : undefined;
    const target = original && original.kind === "dir" && !this.isInTrash(original.id) ? original.id : HOME_ID;
    this.unlink(node);
    const next: FsNode = { ...node, parentId: target, name: this.uniqueName(target, node.name), modifiedAt: Date.now() };
    delete next.trash;
    this.nodes.set(id, next);
    this.link(next);
    this.persist([next], []);
    return ok(next);
  }

  /** Permanently delete an item and everything inside it. This cannot be undone. */
  deletePermanently(id: string): Result<number> {
    const node = this.nodes.get(id);
    if (!node || !node.parentId) return fail("That item no longer exists.");
    if (node.system) return fail(`"${node.name}" is a built-in folder and can't be deleted.`);
    return ok(this.removeSubtree(node));
  }

  emptyTrash(): number {
    let count = 0;
    for (const id of [...(this.kids.get(TRASH_ID) ?? [])]) {
      const node = this.nodes.get(id);
      if (node) count += this.removeSubtree(node);
    }
    return count;
  }

  private removeSubtree(node: FsNode): number {
    const all = [node, ...this.descendants(node.id)];
    this.unlink(node);
    for (const n of all) {
      this.nodes.delete(n.id);
      this.kids.delete(n.id);
    }
    this.persist([], all.map((n) => n.id));
    return all.length;
  }

  /** Erase every file and folder and recreate the defaults. */
  async reset(): Promise<void> {
    await this.flush();
    await this.adapter.clear();
    this.nodes.clear();
    this.kids.clear();
    this.ingest([]);
    this.seed();
    await this.flush();
    await this.adapter.setMeta("seeded", true);
    this.version++;
    this.listeners.forEach((l) => l());
  }
}

const WELCOME_NOTE = `# Welcome to TinyTools OS

Your little computer. Anywhere.

This is a **desktop that lives in your browser**. Everything here works offline once loaded.

## Try this

- Open **Terminal** and type \`mkdir projects\`, then open **File Explorer** and look in your home folder.
- Drag windows by their title bars, resize them from the edges, double-click a title bar to maximize.
- Right-click the desktop for options, or press **Ctrl+K** to search for apps.
- Open **Settings** to change the theme, accent color, and wallpaper.

## Where are my files?

Files, notes and folders are stored in **this browser only**, in a private area called IndexedDB. They are not uploaded anywhere and are separate from the real files on your computer. Use the import and export buttons in File Explorer to move files between the two.

Clearing this site's data in your browser settings will delete them, so export anything important.
`;

const ABOUT_TEXT = `TinyTools OS
============

A free, playful, useful desktop that lives in your browser.

- No account, no ads, no analytics.
- Files are stored in your browser (IndexedDB), not on a server.
- The terminal is a simulation: it only understands TinyTools OS commands and never runs anything on your computer.
`;
