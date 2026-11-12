// Node's own Blob/File/structuredClone are needed so the fake IndexedDB can store binary data faithfully
// (jsdom ships a Blob that Node's structured clone cannot copy).
// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { createIndexedDbAdapter, createMemoryAdapter, openDatabase } from "./adapters";
import { validateName, dedupeName, splitExtension } from "./names";
import { DESKTOP_ID, DOCUMENTS_ID, HOME_ID, NOTES_ID, ROOT_ID, TRASH_ID } from "./types";
import { VirtualFileSystem } from "./vfs";

async function freshFs() {
  const adapter = createMemoryAdapter();
  const fs = await VirtualFileSystem.open(adapter);
  return { fs, adapter };
}

const names = (fs: VirtualFileSystem, id: string) => fs.list(id, { hidden: true }).map((n) => n.name);

describe("first run", () => {
  it("creates the standard folders and welcome files", async () => {
    const { fs } = await freshFs();
    expect(fs.pathOf(HOME_ID)).toBe("/home/user");
    expect(names(fs, HOME_ID)).toEqual(["Desktop", "Documents", "Downloads", "Notes", "Pictures"]);
    expect(names(fs, NOTES_ID)).toEqual(["Welcome to TinyTools OS.md"]);
    expect(fs.persistent).toBe(true);
  });

  it("does not recreate defaults after the user deletes them", async () => {
    const { fs, adapter } = await freshFs();
    fs.deletePermanently(fs.findChild(NOTES_ID, "Welcome to TinyTools OS.md")!.id);
    await fs.flush();
    const again = await VirtualFileSystem.open(adapter);
    expect(names(again, NOTES_ID)).toEqual([]);
  });
});

describe("names", () => {
  it("validates", () => {
    expect(validateName("  ok.txt  ")).toEqual({ ok: true, value: "ok.txt" });
    for (const bad of ["", "   ", ".", "..", "a/b", "a\\b", "x\u0000y", "a".repeat(121)]) {
      expect(validateName(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("splits extensions sensibly", () => {
    expect(splitExtension("a.txt")).toEqual(["a", ".txt"]);
    expect(splitExtension(".bashrc")).toEqual([".bashrc", ""]);
    expect(splitExtension("archive.tar.gz")).toEqual(["archive.tar", ".gz"]);
    expect(splitExtension("noext")).toEqual(["noext", ""]);
  });

  it("dedupes with the extension kept", () => {
    const taken = new Set(["a.txt", "a (2).txt"]);
    expect(dedupeName("a.txt", (n) => taken.has(n))).toBe("a (3).txt");
    expect(dedupeName("new.txt", (n) => taken.has(n))).toBe("new.txt");
  });
});

describe("creating and reading", () => {
  let fs: VirtualFileSystem;
  beforeEach(async () => {
    fs = (await freshFs()).fs;
  });

  it("makes folders and files", () => {
    const dir = fs.mkdir(DOCUMENTS_ID, "projects");
    expect(dir.ok).toBe(true);
    if (!dir.ok) return;
    const file = fs.createFile(dir.value.id, "todo.txt", "buy milk");
    expect(file.ok && fs.readText(file.value.id)).toEqual({ ok: true, value: "buy milk" });
    expect(fs.pathOf(file.ok ? file.value.id : "")).toBe("/home/user/Documents/projects/todo.txt");
  });

  it("rejects duplicates case-insensitively, with a readable message", () => {
    fs.mkdir(DOCUMENTS_ID, "Projects");
    const r = fs.mkdir(DOCUMENTS_ID, "projects");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/already exists/);
  });

  it("rejects invalid names and missing parents", () => {
    expect(fs.mkdir(DOCUMENTS_ID, "a/b").ok).toBe(false);
    expect(fs.mkdir("nope", "x").ok).toBe(false);
    const file = fs.createFile(DOCUMENTS_ID, "f.txt", "x");
    if (file.ok) expect(fs.mkdir(file.value.id, "x").ok).toBe(false);
  });

  it("mkdirp builds nested paths and tolerates existing ones", () => {
    const r = fs.mkdirp("a/b/c", DOCUMENTS_ID);
    expect(r.ok && fs.pathOf(r.value.id)).toBe("/home/user/Documents/a/b/c");
    expect(fs.mkdirp("a/b", DOCUMENTS_ID).ok).toBe(true);
    fs.createFile(DOCUMENTS_ID, "file", "");
    expect(fs.mkdirp("file/x", DOCUMENTS_ID).ok).toBe(false);
  });

  it("keeps size in sync when text is written", () => {
    const f = fs.createFile(DOCUMENTS_ID, "n.txt", "héllo");
    if (!f.ok) throw new Error(f.error);
    expect(f.value.size).toBe(6); // é is two bytes
    fs.writeText(f.value.id, "x");
    expect(fs.get(f.value.id)!.size).toBe(1);
  });

  it("refuses to treat binary files as text", () => {
    const f = fs.createFile(DOCUMENTS_ID, "pic.png", new Blob([new Uint8Array([1, 2, 3])]), "image/png");
    if (!f.ok) throw new Error(f.error);
    expect(fs.readText(f.value.id).ok).toBe(false);
    expect(fs.writeText(f.value.id, "x").ok).toBe(false);
    expect(fs.readBlob(f.value.id)!.size).toBe(3);
  });

  it("imports files, applying size limits and unique names", async () => {
    const a = await fs.importFile(DOCUMENTS_ID, new File(["one"], "note.txt", { type: "text/plain" }));
    const b = await fs.importFile(DOCUMENTS_ID, new File(["two"], "note.txt", { type: "text/plain" }));
    expect(a.ok && b.ok).toBe(true);
    expect(names(fs, DOCUMENTS_ID)).toContain("note (2).txt");
    const big = new File(["x"], "big.bin");
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
    const r = await fs.importFile(DOCUMENTS_ID, big);
    expect(r.ok).toBe(false);
  });

  it("lists folders first, in natural order, hiding dotfiles", () => {
    fs.createFile(DOCUMENTS_ID, "file10.txt", "");
    fs.createFile(DOCUMENTS_ID, "file2.txt", "");
    fs.createFile(DOCUMENTS_ID, ".hidden", "");
    fs.mkdir(DOCUMENTS_ID, "zdir");
    const visible = fs.list(DOCUMENTS_ID).map((n) => n.name);
    expect(visible).toEqual(["zdir", "About this computer.txt", "file2.txt", "file10.txt"]);
    expect(fs.list(DOCUMENTS_ID, { hidden: true }).map((n) => n.name)).toContain(".hidden");
  });
});

describe("paths", () => {
  it("resolves absolute, relative, ~, . and ..", async () => {
    const { fs } = await freshFs();
    expect(fs.resolve("/home/user/Documents")?.id).toBe(DOCUMENTS_ID);
    expect(fs.resolve("Documents", HOME_ID)?.id).toBe(DOCUMENTS_ID);
    expect(fs.resolve("~/Desktop")?.id).toBe(DESKTOP_ID);
    expect(fs.resolve("..", DOCUMENTS_ID)?.id).toBe(HOME_ID);
    expect(fs.resolve("./../Desktop", DOCUMENTS_ID)?.id).toBe(DESKTOP_ID);
    expect(fs.resolve("/")?.id).toBe(ROOT_ID);
    expect(fs.resolve("../../../../..", DOCUMENTS_ID)?.id).toBe(ROOT_ID);
    expect(fs.resolve("/nope")).toBeUndefined();
    expect(fs.resolve("documents", HOME_ID)?.id).toBe(DOCUMENTS_ID);
  });
});

describe("rename, move, copy", () => {
  let fs: VirtualFileSystem;
  beforeEach(async () => {
    fs = (await freshFs()).fs;
  });

  it("renames and blocks collisions", () => {
    const a = fs.createFile(DOCUMENTS_ID, "a.txt", "");
    fs.createFile(DOCUMENTS_ID, "b.txt", "");
    if (!a.ok) throw new Error(a.error);
    expect(fs.rename(a.value.id, "b.txt").ok).toBe(false);
    expect(fs.rename(a.value.id, "c.txt").ok).toBe(true);
    expect(fs.get(a.value.id)!.name).toBe("c.txt");
    expect(fs.rename(a.value.id, "c.txt").ok).toBe(true);
  });

  it("protects built-in folders", () => {
    expect(fs.rename(DOCUMENTS_ID, "Docs").ok).toBe(false);
    expect(fs.move(DOCUMENTS_ID, DESKTOP_ID).ok).toBe(false);
    expect(fs.trash(DOCUMENTS_ID).ok).toBe(false);
    expect(fs.deletePermanently(DOCUMENTS_ID).ok).toBe(false);
    expect(fs.trash(ROOT_ID).ok).toBe(false);
  });

  it("moves between folders and rejects loops", () => {
    const a = fs.mkdir(DOCUMENTS_ID, "a");
    const b = fs.mkdir(DOCUMENTS_ID, "b");
    if (!a.ok || !b.ok) throw new Error("setup");
    expect(fs.move(b.value.id, a.value.id).ok).toBe(true);
    expect(fs.pathOf(b.value.id)).toBe("/home/user/Documents/a/b");
    expect(fs.move(a.value.id, b.value.id).ok).toBe(false);
    expect(fs.move(a.value.id, a.value.id).ok).toBe(false);
  });

  it("refuses to move onto a name clash", () => {
    const f = fs.createFile(DOCUMENTS_ID, "same.txt", "");
    fs.createFile(DESKTOP_ID, "same.txt", "");
    if (!f.ok) throw new Error("setup");
    expect(fs.move(f.value.id, DESKTOP_ID).ok).toBe(false);
  });

  it("deep-copies folders with new ids and de-duplicated names", () => {
    const dir = fs.mkdir(DOCUMENTS_ID, "proj");
    if (!dir.ok) throw new Error("setup");
    fs.createFile(dir.value.id, "x.txt", "data");
    const copy = fs.copy(dir.value.id, DOCUMENTS_ID);
    expect(copy.ok && copy.value.name).toBe("proj (2)");
    if (!copy.ok) return;
    expect(copy.value.id).not.toBe(dir.value.id);
    const inner = fs.list(copy.value.id);
    expect(inner.map((n) => n.name)).toEqual(["x.txt"]);
    expect(inner[0]!.id).not.toBe(fs.list(dir.value.id)[0]!.id);
    expect(fs.readText(inner[0]!.id)).toEqual({ ok: true, value: "data" });
  });

  it("cannot copy a folder into itself", () => {
    const dir = fs.mkdir(DOCUMENTS_ID, "p");
    const sub = dir.ok ? fs.mkdir(dir.value.id, "sub") : null;
    if (!dir.ok || !sub?.ok) throw new Error("setup");
    expect(fs.copy(dir.value.id, sub.value.id).ok).toBe(false);
  });
});

describe("trash", () => {
  let fs: VirtualFileSystem;
  beforeEach(async () => {
    fs = (await freshFs()).fs;
  });

  it("moves items to the trash and restores them to where they were", () => {
    const f = fs.createFile(DOCUMENTS_ID, "gone.txt", "bye");
    if (!f.ok) throw new Error("setup");
    expect(fs.trash(f.value.id).ok).toBe(true);
    expect(names(fs, DOCUMENTS_ID)).not.toContain("gone.txt");
    expect(fs.list(TRASH_ID, { hidden: true }).map((n) => n.name)).toEqual(["gone.txt"]);
    expect(fs.isInTrash(f.value.id)).toBe(true);
    expect(fs.trashCount()).toBe(1);

    expect(fs.restore(f.value.id).ok).toBe(true);
    expect(fs.pathOf(f.value.id)).toBe("/home/user/Documents/gone.txt");
    expect(fs.isInTrash(f.value.id)).toBe(false);
    expect(fs.get(f.value.id)!.trash).toBeUndefined();
  });

  it("restores to Home when the original folder is gone, and avoids name clashes", () => {
    const dir = fs.mkdir(DOCUMENTS_ID, "tmp");
    if (!dir.ok) throw new Error("setup");
    const f = fs.createFile(dir.value.id, "a.txt", "");
    if (!f.ok) throw new Error("setup");
    fs.trash(f.value.id);
    fs.deletePermanently(dir.value.id);
    fs.createFile(HOME_ID, "a.txt", "existing");
    const r = fs.restore(f.value.id);
    expect(r.ok && fs.pathOf(r.value.id)).toBe("/home/user/a (2).txt");
  });

  it("keeps folder contents intact while trashed, and hides them from search", () => {
    const dir = fs.mkdir(DOCUMENTS_ID, "box");
    if (!dir.ok) throw new Error("setup");
    fs.createFile(dir.value.id, "inside.txt", "");
    fs.trash(dir.value.id);
    expect(fs.search("inside").length).toBe(0);
    expect(fs.search("inside", TRASH_ID).length).toBe(1);
    expect(fs.list(dir.value.id).map((n) => n.name)).toEqual(["inside.txt"]);
  });

  it("refuses to add to a trashed folder, and to trash twice", () => {
    const dir = fs.mkdir(DOCUMENTS_ID, "box");
    if (!dir.ok) throw new Error("setup");
    fs.trash(dir.value.id);
    expect(fs.createFile(dir.value.id, "x", "").ok).toBe(false);
    expect(fs.trash(dir.value.id).ok).toBe(false);
  });

  it("renames items trashed under the same name", () => {
    const a = fs.createFile(DOCUMENTS_ID, "dup.txt", "1");
    if (!a.ok) throw new Error("setup");
    fs.trash(a.value.id);
    const b = fs.createFile(DOCUMENTS_ID, "dup.txt", "2");
    if (!b.ok) throw new Error("setup");
    fs.trash(b.value.id);
    expect(names(fs, TRASH_ID).sort()).toEqual(["dup (2).txt", "dup.txt"]);
  });

  it("permanently deletes subtrees and empties the trash", () => {
    const dir = fs.mkdir(DOCUMENTS_ID, "box");
    if (!dir.ok) throw new Error("setup");
    const inner = fs.createFile(dir.value.id, "inside.txt", "");
    fs.trash(dir.value.id);
    const removed = fs.emptyTrash();
    expect(removed).toBe(2);
    expect(fs.trashCount()).toBe(0);
    expect(fs.get(dir.value.id)).toBeUndefined();
    expect(inner.ok && fs.get(inner.value.id)).toBeUndefined();
  });
});

describe("search", () => {
  it("finds items by name below a folder", async () => {
    const { fs } = await freshFs();
    const dir = fs.mkdir(DOCUMENTS_ID, "reports");
    if (!dir.ok) throw new Error("setup");
    fs.createFile(dir.value.id, "Annual Report.txt", "");
    // Ordered by name, regardless of depth.
    expect(fs.search("report", HOME_ID).map((h) => h.path)).toEqual([
      "/home/user/Documents/reports/Annual Report.txt",
      "/home/user/Documents/reports",
    ]);
    expect(fs.search("   ")).toEqual([]);
  });
});

describe("change notification", () => {
  it("notifies subscribers and bumps the version on every change", async () => {
    const { fs } = await freshFs();
    let calls = 0;
    const off = fs.subscribe(() => calls++);
    const v = fs.getVersion();
    fs.mkdir(DOCUMENTS_ID, "x");
    expect(calls).toBe(1);
    expect(fs.getVersion()).toBe(v + 1);
    off();
    fs.mkdir(DOCUMENTS_ID, "y");
    expect(calls).toBe(1);
  });
});

describe("persistence with IndexedDB", () => {
  async function open(factory: IDBFactory) {
    const db = await openDatabase(factory, "test-db");
    return VirtualFileSystem.open(createIndexedDbAdapter(db));
  }

  it("round-trips folders, text and binary files across sessions", async () => {
    const factory = new IDBFactory();
    const first = await open(factory);
    const dir = first.mkdir(DOCUMENTS_ID, "saved");
    if (!dir.ok) throw new Error("setup");
    first.createFile(dir.value.id, "t.txt", "persist me");
    first.createFile(dir.value.id, "b.png", new Blob([new Uint8Array([9, 8, 7])]), "image/png");
    const trashed = first.createFile(dir.value.id, "old.txt", "x");
    if (trashed.ok) first.trash(trashed.value.id);
    await first.flush();

    const second = await open(factory);
    const saved = second.resolve("/home/user/Documents/saved")!;
    expect(second.list(saved.id).map((n) => n.name)).toEqual(["b.png", "t.txt"]);
    expect(second.readText(second.findChild(saved.id, "t.txt")!.id)).toEqual({ ok: true, value: "persist me" });
    const blob = second.readBlob(second.findChild(saved.id, "b.png")!.id)!;
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
    expect(second.trashCount()).toBe(1);
    // seeded exactly once
    expect(names(second, NOTES_ID)).toEqual(["Welcome to TinyTools OS.md"]);
  });

  it("persists deletions", async () => {
    const factory = new IDBFactory();
    const first = await open(factory);
    const dir = first.mkdir(DOCUMENTS_ID, "temp");
    if (!dir.ok) throw new Error("setup");
    first.deletePermanently(dir.value.id);
    await first.flush();
    expect(names(await open(factory), DOCUMENTS_ID)).not.toContain("temp");
  });

  it("reset() erases everything and restores defaults", async () => {
    const factory = new IDBFactory();
    const fs = await open(factory);
    fs.mkdir(DOCUMENTS_ID, "mine");
    await fs.reset();
    expect(names(fs, DOCUMENTS_ID)).toEqual(["About this computer.txt"]);
    expect(names(await open(factory), DOCUMENTS_ID)).toEqual(["About this computer.txt"]);
  });
});

describe("damaged storage", () => {
  it("ignores malformed records instead of crashing", async () => {
    const adapter = createMemoryAdapter();
    adapter.loadAll = async () => [null, 5, "x", { id: 1 }, { id: "a", kind: "weird", name: "n" }, { id: "ok", parentId: "root", name: "fine.txt", kind: "file", data: "hi" }];
    await adapter.setMeta("seeded", true);
    const fs = await VirtualFileSystem.open(adapter);
    expect(fs.get("ok")?.name).toBe("fine.txt");
    expect(fs.readText("ok")).toEqual({ ok: true, value: "hi" });
  });

  it("re-attaches orphans and breaks parent loops", async () => {
    const adapter = createMemoryAdapter();
    const now = Date.now();
    const base = { mime: "inode/directory", size: 0, createdAt: now, modifiedAt: now, kind: "dir" };
    adapter.loadAll = async () => [
      { ...base, id: "orphan", parentId: "missing", name: "orphan" },
      { ...base, id: "loopA", parentId: "loopB", name: "A" },
      { ...base, id: "loopB", parentId: "loopA", name: "B" },
    ];
    await adapter.setMeta("seeded", true);
    const fs = await VirtualFileSystem.open(adapter);
    for (const id of ["orphan", "loopA", "loopB"]) {
      expect(fs.pathOf(id).startsWith("/"), id).toBe(true);
      expect(fs.isDescendant(id, ROOT_ID), id).toBe(true);
    }
  });

  it("always has a root and a trash, even from empty storage", async () => {
    const adapter = createMemoryAdapter();
    await adapter.setMeta("seeded", true);
    const fs = await VirtualFileSystem.open(adapter);
    expect(fs.get(ROOT_ID)).toBeDefined();
    expect(fs.get(TRASH_ID)).toBeDefined();
  });

  it("reports storage write failures instead of throwing", async () => {
    const adapter = createMemoryAdapter();
    const fs = await VirtualFileSystem.open(adapter);
    let reported: unknown;
    fs.onPersistError = (e) => (reported = e);
    adapter.apply = async () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(fs.mkdir(DOCUMENTS_ID, "x").ok).toBe(true);
    await fs.flush();
    expect(reported).toBeInstanceOf(DOMException);
  });
});
