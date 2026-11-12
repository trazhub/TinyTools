// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createMemoryAdapter } from "../../filesystem/adapters";
import { DESKTOP_ID, DOCUMENTS_ID, HOME_ID, ROOT_ID, TRASH_ID, type FsNode } from "../../filesystem/types";
import { VirtualFileSystem } from "../../filesystem/vfs";
import { buildExport, collectFiles } from "./export";
import { breadcrumbs, canGoBack, canGoForward, goBack, goForward, isBrowsable, navigate, selectRange, sortNodes } from "./model";

const node = (over: Partial<FsNode> & { name: string }): FsNode => ({
  id: over.name,
  parentId: "p",
  kind: "file",
  mime: "text/plain",
  size: 0,
  createdAt: 0,
  modifiedAt: 0,
  ...over,
});

describe("sortNodes", () => {
  const items = [
    node({ name: "b.txt", size: 20, modifiedAt: 300 }),
    node({ name: "A.txt", size: 10, modifiedAt: 100 }),
    node({ name: "file10.txt", size: 30, modifiedAt: 200 }),
    node({ name: "file2.txt", size: 5, modifiedAt: 400 }),
    node({ name: "zeta", kind: "dir", mime: "inode/directory" }),
    node({ name: "alpha", kind: "dir", mime: "inode/directory" }),
  ];
  const names = (sorted: FsNode[]) => sorted.map((n) => n.name);

  it("sorts by name naturally and keeps folders first", () => {
    expect(names(sortNodes(items, { key: "name", dir: "asc" }))).toEqual(["alpha", "zeta", "A.txt", "b.txt", "file2.txt", "file10.txt"]);
  });

  it("keeps folders first when descending too", () => {
    expect(names(sortNodes(items, { key: "name", dir: "desc" }))).toEqual(["zeta", "alpha", "file10.txt", "file2.txt", "b.txt", "A.txt"]);
  });

  it("sorts by size and modified date", () => {
    expect(names(sortNodes(items, { key: "size", dir: "asc" })).slice(2)).toEqual(["file2.txt", "A.txt", "b.txt", "file10.txt"]);
    expect(names(sortNodes(items, { key: "modified", dir: "desc" })).slice(2)).toEqual(["file2.txt", "b.txt", "file10.txt", "A.txt"]);
  });

  it("does not mutate its input", () => {
    const copy = [...items];
    sortNodes(items, { key: "size", dir: "desc" });
    expect(items).toEqual(copy);
  });
});

describe("selectRange", () => {
  const order = ["a", "b", "c", "d", "e"];
  it("selects inclusively in either direction", () => {
    expect(selectRange(order, "b", "d")).toEqual(["b", "c", "d"]);
    expect(selectRange(order, "d", "b")).toEqual(["b", "c", "d"]);
  });
  it("falls back sensibly", () => {
    expect(selectRange(order, null, "c")).toEqual(["c"]);
    expect(selectRange(order, "zzz", "c")).toEqual(["c"]);
    expect(selectRange(order, "a", "zzz")).toEqual([]);
  });
});

describe("history navigation", () => {
  it("records visits, supports back/forward and drops the forward branch on a new visit", () => {
    let nav = { stack: ["home"], index: 0 };
    nav = navigate(nav, "docs");
    nav = navigate(nav, "docs/sub");
    expect(nav).toEqual({ stack: ["home", "docs", "docs/sub"], index: 2 });
    nav = goBack(goBack(nav));
    expect(nav.index).toBe(0);
    expect(canGoBack(nav)).toBe(false);
    expect(canGoForward(nav)).toBe(true);
    nav = goForward(nav);
    expect(nav.stack[nav.index]).toBe("docs");
    nav = navigate(nav, "pics");
    expect(nav.stack).toEqual(["home", "docs", "pics"]);
    expect(navigate(nav, "pics")).toBe(nav);
    expect(goBack({ stack: ["x"], index: 0 })).toEqual({ stack: ["x"], index: 0 });
  });

  it("caps history length", () => {
    let nav = { stack: ["0"], index: 0 };
    for (let i = 1; i < 120; i++) nav = navigate(nav, String(i));
    expect(nav.stack.length).toBe(50);
    expect(nav.stack[nav.index]).toBe("119");
  });
});

describe("with a filesystem", () => {
  async function setup() {
    const fs = await VirtualFileSystem.open(createMemoryAdapter());
    return fs;
  }

  it("builds breadcrumbs", async () => {
    const fs = await setup();
    const sub = fs.mkdirp("a/b", DOCUMENTS_ID);
    if (!sub.ok) throw new Error(sub.error);
    expect(breadcrumbs(fs, sub.value.id).map((c) => c.label)).toEqual(["Home", "Documents", "a", "b"]);
    expect(breadcrumbs(fs, HOME_ID).map((c) => c.label)).toEqual(["Home"]);
    expect(breadcrumbs(fs, ROOT_ID).map((c) => c.label)).toEqual(["Computer"]);
    expect(breadcrumbs(fs, TRASH_ID)).toEqual([{ id: TRASH_ID, label: "Trash" }]);
  });

  it("knows which folders can be browsed", async () => {
    const fs = await setup();
    const dir = fs.mkdir(DOCUMENTS_ID, "x");
    if (!dir.ok) throw new Error("setup");
    expect(isBrowsable(fs, dir.value.id)).toBe(true);
    fs.trash(dir.value.id);
    expect(isBrowsable(fs, dir.value.id)).toBe(true); // browsable from inside the trash
    expect(isBrowsable(fs, "gone")).toBe(false);
    const file = fs.createFile(DOCUMENTS_ID, "f.txt", "");
    expect(file.ok && isBrowsable(fs, file.value.id)).toBe(false);
  });

  it("collects files for export with folder structure", async () => {
    const fs = await setup();
    const dir = fs.mkdirp("proj/src", DESKTOP_ID);
    if (!dir.ok) throw new Error("setup");
    const proj = fs.resolve("proj", DESKTOP_ID)!;
    fs.createFile(dir.value.id, "main.ts", "code");
    fs.createFile(proj.id, "README.md", "hi");
    expect(collectFiles(fs, [proj.id]).map((f) => f.path).sort()).toEqual(["proj/README.md", "proj/src/main.ts"]);
  });

  it("exports a single file as-is and folders as a ZIP", async () => {
    const fs = await setup();
    const f = fs.createFile(DOCUMENTS_ID, "note.txt", "hello");
    if (!f.ok) throw new Error("setup");
    const single = await buildExport(fs, [f.value.id]);
    expect(single.ok && single.filename).toBe("note.txt");
    expect(single.ok && (await single.blob.text())).toBe("hello");

    const multi = await buildExport(fs, [DOCUMENTS_ID]);
    expect(multi.ok && multi.filename).toBe("Documents.zip");
    if (multi.ok) {
      const bytes = new Uint8Array(await multi.blob.arrayBuffer());
      expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x04034b50);
    }
  });

  it("reports nothing to export for empty selections and empty folders", async () => {
    const fs = await setup();
    expect((await buildExport(fs, [])).ok).toBe(false);
    const dir = fs.mkdir(DOCUMENTS_ID, "empty");
    if (!dir.ok) throw new Error("setup");
    const r = await buildExport(fs, [dir.value.id]);
    expect(r.ok).toBe(false);
  });
});
