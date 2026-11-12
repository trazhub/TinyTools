"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Home as HomeIcon,
  ImageIcon,
  LayoutGrid,
  List,
  type LucideIcon,
  Monitor,
  NotebookText,
  Pencil,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  Trash2,
  Upload,
  X,
  FileText,
  Download as DownloadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { DESKTOP_ID, DOCUMENTS_ID, DOWNLOADS_ID, HOME_ID, NOTES_ID, PICTURES_ID, TRASH_ID, type FsNode } from "../../filesystem/types";
import { useStore } from "../../lib/store";
import { readJson, writeJson, isRecord } from "../../storage/safe-storage";
import { useFsVersion, useKernel, useWindowTitle } from "../../system/kernel-context";
import { separator, type MenuItem } from "../../system/menus";
import { useContextMenu } from "../../system/use-context-menu";
import type { AppComponentProps } from "../types";
import { explorerClipboard } from "./clipboard";
import { buildExport } from "./export";
import { DRAG_TYPE, FileGridView, FileListView, type Entry, type ViewProps } from "./file-views";
import {
  SORT_LABELS,
  breadcrumbs,
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  isBrowsable,
  navigate,
  selectRange,
  sortNodes,
  type NavState,
  type SortKey,
  type SortSpec,
} from "./model";
import { PreviewPane } from "./preview-pane";

const PLACES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: HOME_ID, label: "Home", icon: HomeIcon },
  { id: DESKTOP_ID, label: "Desktop", icon: Monitor },
  { id: DOCUMENTS_ID, label: "Documents", icon: FileText },
  { id: DOWNLOADS_ID, label: "Downloads", icon: DownloadIcon },
  { id: PICTURES_ID, label: "Pictures", icon: ImageIcon },
  { id: NOTES_ID, label: "Notes", icon: NotebookText },
];

const PREFS_KEY = "tinytools-os:explorer";
type ViewMode = "list" | "grid";

function loadPrefs(): { view: ViewMode; sort: SortSpec } {
  const raw = readJson("local", PREFS_KEY);
  const fallback = { view: "list" as ViewMode, sort: { key: "name", dir: "asc" } as SortSpec };
  if (!isRecord(raw)) return fallback;
  const view = raw.view === "grid" ? "grid" : "list";
  const s = isRecord(raw.sort) ? raw.sort : {};
  const key = (["name", "modified", "size", "type"] as const).find((k) => k === s.key) ?? "name";
  return { view, sort: { key, dir: s.dir === "desc" ? "desc" : "asc" } };
}

export default function ExplorerApp({ windowId, props }: AppComponentProps) {
  const kernel = useKernel();
  const { fs } = kernel;
  const version = useFsVersion();

  const startFolder = typeof props.folderId === "string" && isBrowsable(fs, props.folderId) ? props.folderId : HOME_ID;
  const [nav, setNav] = useState<NavState>({ stack: [startFolder], index: 0 });
  const [selection, setSelection] = useState<string[]>(typeof props.select === "string" ? [props.select] : []);
  const [anchor, setAnchor] = useState<string | null>(typeof props.select === "string" ? props.select : null);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragOverFiles, setDragOverFiles] = useState(false);
  const clipboard = useStore(explorerClipboard, (c) => c);
  const importRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const requested = nav.stack[nav.index]!;
  const location = isBrowsable(fs, requested) ? requested : HOME_ID;
  const inTrash = location === TRASH_ID || fs.isInTrash(location);
  const atTrashRoot = location === TRASH_ID;
  const here = fs.get(location)!;
  const searching = query.trim() !== "";
  const crumbs = breadcrumbs(fs, location);

  useWindowTitle(windowId, `${crumbs[crumbs.length - 1]?.label ?? "Computer"} · File Explorer`);

  const entries: Entry[] = useMemo(() => {
    // `version` makes this recompute when files change.
    void version;
    const raw: Entry[] = searching
      ? fs.search(query, location).map((hit) => ({ node: hit.node, location: hit.path.slice(0, hit.path.lastIndexOf("/")) || "/" }))
      : fs.list(location, { hidden: atTrashRoot }).map((node) => ({
          node,
          ...(atTrashRoot && node.trash ? { location: `From ${fs.get(node.trash.from) ? fs.pathOf(node.trash.from) : "a deleted folder"}` } : {}),
        }));
    const order = new Map(sortNodes(raw.map((e) => e.node), prefs.sort).map((n, i) => [n.id, i]));
    return raw.sort((a, b) => order.get(a.node.id)! - order.get(b.node.id)!);
  }, [fs, version, location, query, searching, atTrashRoot, prefs.sort]);

  const entryIds = useMemo(() => entries.map((e) => e.node.id), [entries]);
  const activeSelection = selection.filter((id) => entryIds.includes(id));
  const selectedNodes = activeSelection.map((id) => fs.get(id)).filter((n): n is FsNode => Boolean(n));
  const only = selectedNodes.length === 1 ? selectedNodes[0]! : null;

  // ---- navigation -----------------------------------------------------------
  const go = (id: string) => {
    setNav((n) => navigate(n, id));
    setSelection([]);
    setAnchor(null);
    setQuery("");
    setRenaming(null);
  };
  const up = () => {
    const parent = location === TRASH_ID ? HOME_ID : here.parentId;
    if (parent && parent !== location && isBrowsable(fs, parent)) go(parent);
  };
  const stepHistory = (fn: (n: NavState) => NavState) => {
    setNav(fn);
    setSelection([]);
    setQuery("");
    setRenaming(null);
  };

  const open = (node: FsNode) => {
    if (node.kind === "dir") return go(node.id);
    if (inTrash) return kernel.notify({ title: "This file is in the Trash", message: "Restore it first to open it." });
    kernel.openNode(node);
  };

  // ---- selection --------------------------------------------------------------
  const clickItem = (e: MouseEvent, node: FsNode, touch: boolean) => {
    if (touch && !e.ctrlKey && !e.shiftKey) {
      setSelection([node.id]);
      setAnchor(node.id);
      return open(node);
    }
    if (e.shiftKey) {
      setSelection(selectRange(entryIds, anchor ?? activeSelection[0] ?? null, node.id));
    } else if (e.ctrlKey || e.metaKey) {
      setSelection((s) => (s.includes(node.id) ? s.filter((x) => x !== node.id) : [...s, node.id]));
      setAnchor(node.id);
    } else {
      setSelection([node.id]);
      setAnchor(node.id);
    }
    listRef.current?.focus({ preventScroll: true });
  };

  const moveSelection = (delta: number, extend: boolean) => {
    if (entryIds.length === 0) return;
    const current = activeSelection.length ? entryIds.indexOf(activeSelection[activeSelection.length - 1]!) : delta > 0 ? -1 : entryIds.length;
    const next = Math.min(entryIds.length - 1, Math.max(0, current + delta));
    const target = entryIds[next]!;
    if (extend) setSelection(selectRange(entryIds, anchor ?? entryIds[Math.max(current, 0)]!, target));
    else {
      setSelection([target]);
      setAnchor(target);
    }
  };

  // Keep the newest selected row in view.
  const lastSelected = activeSelection[activeSelection.length - 1];
  useEffect(() => {
    if (!lastSelected) return;
    listRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(lastSelected)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [lastSelected]);

  // ---- file operations ----------------------------------------------------------
  const fail = (title: string, message: string) => kernel.notify({ tone: "error", title, message });

  const newItem = (kind: "dir" | "file") => {
    if (inTrash) return fail("Can't create here", "You can't add items to the Trash.");
    const name = fs.uniqueName(location, kind === "dir" ? "New folder" : "New file.txt");
    const r = kind === "dir" ? fs.mkdir(location, name) : fs.createFile(location, name, "");
    if (!r.ok) return fail("Couldn't create it", r.error);
    setQuery("");
    setSelection([r.value.id]);
    setAnchor(r.value.id);
    setRenaming(r.value.id);
  };

  const commitRename = (id: string, name: string) => {
    setRenaming(null);
    const node = fs.get(id);
    if (!node || name.trim() === node.name) return;
    const r = fs.rename(id, name);
    if (!r.ok) fail("Couldn't rename", r.error);
  };

  const trashSelected = (nodes: FsNode[] = selectedNodes) => {
    if (nodes.length === 0) return;
    let moved = 0;
    for (const n of nodes) {
      const r = fs.trash(n.id);
      if (r.ok) moved++;
      else fail(`Couldn't delete “${n.name}”`, r.error);
    }
    if (moved) kernel.notify({ message: moved === 1 ? `Moved “${nodes[0]!.name}” to the Trash.` : `Moved ${moved} items to the Trash.` });
    setSelection([]);
  };

  const restoreSelected = (nodes: FsNode[] = selectedNodes) => {
    let restored = 0;
    for (const n of nodes) {
      const r = fs.restore(n.id);
      if (r.ok) restored++;
      else fail(`Couldn't restore “${n.name}”`, r.error);
    }
    if (restored) kernel.notify({ tone: "success", message: restored === 1 ? "Restored 1 item." : `Restored ${restored} items.` });
    setSelection([]);
  };

  const deleteForever = async (nodes: FsNode[] = selectedNodes) => {
    if (nodes.length === 0) return;
    const ok = await kernel.confirm({
      title: nodes.length === 1 ? `Permanently delete “${nodes[0]!.name}”?` : `Permanently delete ${nodes.length} items?`,
      message: "This can't be undone.",
      confirmLabel: "Delete forever",
      danger: true,
    });
    if (!ok) return;
    for (const n of nodes) {
      const r = fs.deletePermanently(n.id);
      if (!r.ok) fail(`Couldn't delete “${n.name}”`, r.error);
    }
    setSelection([]);
  };

  const emptyTrash = async () => {
    if (fs.trashCount() === 0) return;
    const ok = await kernel.confirm({ title: "Empty the Trash?", message: `${fs.trashCount()} ${fs.trashCount() === 1 ? "item" : "items"} will be permanently deleted. This can't be undone.`, confirmLabel: "Empty Trash", danger: true });
    if (ok) {
      const count = fs.emptyTrash();
      kernel.notify({ message: `Deleted ${count} ${count === 1 ? "item" : "items"} permanently.` });
      setSelection([]);
    }
  };

  const copySelected = (mode: "copy" | "cut", nodes: FsNode[] = selectedNodes) => {
    if (nodes.length === 0 || inTrash) return;
    explorerClipboard.set({ ids: nodes.map((n) => n.id), mode });
    kernel.notify({ message: `${mode === "copy" ? "Copied" : "Cut"} ${nodes.length === 1 ? `“${nodes[0]!.name}”` : `${nodes.length} items`}. Open another folder and paste.`, duration: 2500 });
  };

  const paste = () => {
    const clip = explorerClipboard.get();
    if (!clip || inTrash) return;
    const created: string[] = [];
    for (const id of clip.ids) {
      const node = fs.get(id);
      if (!node) continue;
      const r = clip.mode === "copy" ? fs.copy(id, location) : fs.move(id, location);
      if (r.ok) created.push(r.value.id);
      else fail(`Couldn't paste “${node.name}”`, r.error);
    }
    if (clip.mode === "cut") explorerClipboard.set(null);
    if (created.length) {
      setSelection(created);
      setAnchor(created[0]!);
    }
  };

  const importFiles = async (files: File[]) => {
    if (inTrash) return fail("Can't import here", "Choose a regular folder first.");
    let imported = 0;
    const problems: string[] = [];
    const ids: string[] = [];
    for (const file of files) {
      const r = await fs.importFile(location, file);
      if (r.ok) {
        imported++;
        ids.push(r.value.id);
      } else problems.push(r.error);
    }
    if (imported) {
      kernel.notify({ tone: "success", message: `Imported ${imported} ${imported === 1 ? "file" : "files"} into ${here.id === HOME_ID ? "Home" : here.name}.` });
      setSelection(ids);
    }
    if (problems.length) fail(problems.length === 1 ? "Couldn't import a file" : `Couldn't import ${problems.length} files`, problems.slice(0, 3).join("\n"));
  };

  const exportNodes = async (nodes: FsNode[]) => {
    const plan = await buildExport(fs, nodes.map((n) => n.id));
    if (!plan.ok) return fail("Nothing to export", plan.error);
    downloadBlob(plan.blob, plan.filename);
    kernel.notify({ tone: "success", message: `Exported ${plan.filename} to your computer's Downloads.`, duration: 3000 });
  };

  // ---- drag and drop ----------------------------------------------------------------
  const onDragStart = (e: DragEvent, node: FsNode) => {
    const ids = activeSelection.includes(node.id) ? activeSelection : [node.id];
    if (!activeSelection.includes(node.id)) setSelection([node.id]);
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  };

  const moveInto = (ids: string[], folderId: string) => {
    for (const id of ids) {
      if (id === folderId) continue;
      const r = fs.move(id, folderId);
      if (!r.ok) fail("Couldn't move it", r.error);
    }
    setSelection([]);
  };

  const readDragIds = (e: DragEvent): string[] => {
    try {
      const parsed: unknown = JSON.parse(e.dataTransfer.getData(DRAG_TYPE));
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };

  const onDropOn = (e: DragEvent, folder: FsNode) => {
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      // Files dragged in from the computer land in the folder they were dropped on.
      void (async () => {
        for (const f of files) {
          const r = await fs.importFile(folder.id, f);
          if (!r.ok) fail("Couldn't import a file", r.error);
        }
      })();
      return;
    }
    moveInto(readDragIds(e), folder.id);
  };

  // ---- menus --------------------------------------------------------------------------
  const nodeMenu = (node: FsNode): MenuItem[] => {
    const targets = activeSelection.includes(node.id) ? selectedNodes : [node];
    if (!activeSelection.includes(node.id)) {
      setSelection([node.id]);
      setAnchor(node.id);
    }
    if (inTrash) {
      return [
        { id: "restore", label: "Restore", icon: RotateCcw, disabled: !atTrashRoot, onSelect: () => restoreSelected(targets) },
        { id: "delete", label: "Delete permanently…", icon: Trash2, danger: true, disabled: !atTrashRoot, onSelect: () => void deleteForever(targets) },
      ];
    }
    return [
      { id: "open", label: node.kind === "dir" ? "Open" : "Open", icon: ExternalLink, disabled: targets.length !== 1, onSelect: () => open(node) },
      ...(node.kind === "dir" ? [{ id: "new-window", label: "Open in new window", icon: FolderOpen, disabled: targets.length !== 1, onSelect: () => void kernel.openApp("explorer", { folderId: node.id }) } as MenuItem] : []),
      separator("s1"),
      { id: "rename", label: "Rename", icon: Pencil, shortcut: "F2", disabled: targets.length !== 1, onSelect: () => setRenaming(node.id) },
      { id: "copy", label: "Copy", icon: Copy, shortcut: "Ctrl+C", onSelect: () => copySelected("copy", targets) },
      { id: "cut", label: "Cut", icon: Scissors, shortcut: "Ctrl+X", onSelect: () => copySelected("cut", targets) },
      separator("s2"),
      { id: "export", label: "Export to my computer", icon: Download, onSelect: () => void exportNodes(targets) },
      separator("s3"),
      { id: "trash", label: "Move to Trash", icon: Trash2, shortcut: "Del", danger: true, onSelect: () => trashSelected(targets) },
    ];
  };

  const backgroundMenu = (): MenuItem[] =>
    inTrash
      ? [{ id: "empty", label: "Empty Trash…", icon: Trash2, danger: true, disabled: fs.trashCount() === 0, onSelect: () => void emptyTrash() }]
      : [
          { id: "new-folder", label: "New folder", icon: FolderPlus, onSelect: () => newItem("dir") },
          { id: "new-file", label: "New text file", icon: FilePlus2, onSelect: () => newItem("file") },
          separator("s1"),
          { id: "paste", label: "Paste", icon: ClipboardPaste, shortcut: "Ctrl+V", disabled: !clipboard, onSelect: paste },
          { id: "import", label: "Import from my computer…", icon: Upload, onSelect: () => importRef.current?.click() },
          separator("s2"),
          { id: "view", label: prefs.view === "list" ? "Switch to grid view" : "Switch to list view", icon: prefs.view === "list" ? LayoutGrid : List, onSelect: () => updatePrefs({ view: prefs.view === "list" ? "grid" : "list" }) },
        ];

  const { props: backgroundMenuProps } = useContextMenu(backgroundMenu);

  function updatePrefs(patch: Partial<{ view: ViewMode; sort: SortSpec }>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeJson("local", PREFS_KEY, next);
  }

  const changeSort = (key: SortKey) =>
    updatePrefs({ sort: { key, dir: prefs.sort.key === key && prefs.sort.dir === "asc" ? "desc" : "asc" } });

  const showSortMenu = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    kernel.showMenu(
      [
        ...(["name", "modified", "type", "size"] as const).map((key): MenuItem => ({ id: key, label: SORT_LABELS[key], checked: prefs.sort.key === key, onSelect: () => updatePrefs({ sort: { ...prefs.sort, key } }) })),
        separator("s"),
        { id: "asc", label: "Ascending", checked: prefs.sort.dir === "asc", onSelect: () => updatePrefs({ sort: { ...prefs.sort, dir: "asc" } }) },
        { id: "desc", label: "Descending", checked: prefs.sort.dir === "desc", onSelect: () => updatePrefs({ sort: { ...prefs.sort, dir: "desc" } }) },
      ],
      r.left,
      r.bottom + 4,
    );
  };

  const showNewMenu = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    kernel.showMenu(
      [
        { id: "folder", label: "Folder", icon: FolderPlus, onSelect: () => newItem("dir") },
        { id: "file", label: "Text file", icon: FilePlus2, onSelect: () => newItem("file") },
      ],
      r.left,
      r.bottom + 4,
    );
  };

  const showPlacesMenu = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    kernel.showMenu(
      [...PLACES, { id: TRASH_ID, label: "Trash", icon: Trash2 }].map((p): MenuItem => ({ id: p.id, label: p.label, icon: p.icon, checked: location === p.id, onSelect: () => go(p.id) })),
      r.left,
      r.bottom + 4,
    );
  };

  // ---- keyboard ------------------------------------------------------------------------
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (renaming) return;
    const mod = e.ctrlKey || e.metaKey;
    const columns = () => {
      const tiles = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-node-id]") ?? [])];
      if (tiles.length < 2 || prefs.view !== "grid") return 1;
      const firstTop = tiles[0]!.offsetTop;
      const idx = tiles.findIndex((t) => t.offsetTop !== firstTop);
      return idx === -1 ? tiles.length : idx;
    };
    const handled = (fn: () => void) => {
      e.preventDefault();
      fn();
    };

    if (e.key === "ArrowDown") handled(() => moveSelection(prefs.view === "grid" ? columns() : 1, e.shiftKey));
    else if (e.key === "ArrowUp" && !e.altKey) handled(() => moveSelection(prefs.view === "grid" ? -columns() : -1, e.shiftKey));
    else if (e.key === "ArrowRight" && prefs.view === "grid") handled(() => moveSelection(1, e.shiftKey));
    else if (e.key === "ArrowLeft" && prefs.view === "grid") handled(() => moveSelection(-1, e.shiftKey));
    else if (e.key === "Home") handled(() => moveSelection(-entryIds.length, e.shiftKey));
    else if (e.key === "End") handled(() => moveSelection(entryIds.length, e.shiftKey));
    else if (e.key === "Enter" && only) handled(() => open(only));
    else if (e.key === "F2" && only && !inTrash) handled(() => setRenaming(only.id));
    else if (e.key === "Delete" && selectedNodes.length) handled(() => (inTrash ? void deleteForever() : trashSelected()));
    else if ((e.key === "Backspace" || (e.altKey && e.key === "ArrowUp")) && !searching) handled(up);
    else if (e.key === "Escape") handled(() => (searching ? setQuery("") : setSelection([])));
    else if (mod && e.key.toLowerCase() === "a") handled(() => setSelection(entryIds));
    else if (mod && e.key.toLowerCase() === "c") handled(() => copySelected("copy"));
    else if (mod && e.key.toLowerCase() === "x") handled(() => copySelected("cut"));
    else if (mod && e.key.toLowerCase() === "v") handled(paste);
  };

  const viewProps: ViewProps = {
    entries,
    selection: new Set(activeSelection),
    cutIds: new Set(clipboard?.mode === "cut" ? clipboard.ids : []),
    renaming,
    sort: prefs.sort,
    inTrash,
    showLocation: searching || atTrashRoot,
    getMenu: nodeMenu,
    onSortChange: changeSort,
    onClick: clickItem,
    onOpen: open,
    onRename: commitRename,
    onCancelRename: () => setRenaming(null),
    onDragStart,
    onDropOn,
  };

  const totalSelectedBytes = selectedNodes.reduce((n, x) => n + (x.kind === "file" ? x.size : 0), 0);

  return (
    <div
      className="@container flex h-full flex-col"
      data-testid="explorer"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files") && !inTrash) {
          e.preventDefault();
          setDragOverFiles(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragOverFiles(false)}
      onDrop={(e) => {
        setDragOverFiles(false);
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          void importFiles(Array.from(e.dataTransfer.files));
        }
      }}
    >
      {/* Navigation bar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        <Button size="icon-sm" variant="ghost" aria-label="Back" title="Back" disabled={!canGoBack(nav)} onClick={() => stepHistory(goBack)}>
          <ArrowLeft aria-hidden />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Forward" title="Forward" disabled={!canGoForward(nav)} onClick={() => stepHistory(goForward)}>
          <ArrowRight aria-hidden />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Up one folder" title="Up one folder (Backspace)" disabled={location === TRASH_ID ? false : !here.parentId} onClick={up}>
          <ArrowUp aria-hidden />
        </Button>
        <Button size="icon-sm" variant="ghost" className="@xl:hidden" aria-label="Places" title="Places" onClick={showPlacesMenu}>
          <HardDrive aria-hidden />
        </Button>

        <nav aria-label="Location" className="mx-1 min-w-0 flex-1">
          <ol className="flex min-w-0 items-center overflow-hidden rounded-lg border border-input bg-background px-1 py-0.5 text-[13px]">
            {crumbs.map((c, i) => (
              <li key={c.id} className="flex min-w-0 shrink items-center">
                {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                <button
                  type="button"
                  aria-current={i === crumbs.length - 1 ? "location" : undefined}
                  onClick={() => go(c.id)}
                  className={cn("truncate rounded px-1.5 py-0.5 hover:bg-muted", i === crumbs.length - 1 ? "font-semibold" : "text-muted-foreground")}
                >
                  {c.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <label className="relative hidden w-44 shrink-0 @lg:block">
          <span className="sr-only">Search in this folder</span>
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelection([]);
            }}
            placeholder="Search"
            className="h-8 w-full rounded-lg border border-input bg-background pl-7 pr-7 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </label>

        <Button size="icon-sm" variant="ghost" aria-label="Sort" title="Sort" onClick={showSortMenu}>
          <ArrowDownAZ aria-hidden />
        </Button>
        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="View">
          {(["list", "grid"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-label={mode === "list" ? "List view" : "Grid view"}
              aria-pressed={prefs.view === mode}
              title={mode === "list" ? "List view" : "Grid view"}
              onClick={() => updatePrefs({ view: mode })}
              className={cn("grid size-6 place-items-center rounded-md", prefs.view === mode ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              {mode === "list" ? <List className="size-3.5" aria-hidden /> : <LayoutGrid className="size-3.5" aria-hidden />}
            </button>
          ))}
        </div>
      </div>

      {/* Actions bar */}
      <div role="toolbar" aria-label="File actions" className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border px-2 py-1">
        {inTrash ? (
          <>
            <ActionButton icon={RotateCcw} label="Restore" disabled={!atTrashRoot || selectedNodes.length === 0} onClick={() => restoreSelected()} />
            <ActionButton icon={Trash2} label="Delete forever" disabled={!atTrashRoot || selectedNodes.length === 0} onClick={() => void deleteForever()} />
            <ActionButton icon={Trash2} label="Empty Trash" disabled={fs.trashCount() === 0} onClick={() => void emptyTrash()} />
          </>
        ) : (
          <>
            <ActionButton icon={Plus} label="New" onClick={showNewMenu} />
            <ActionButton icon={Upload} label="Import" title="Import files from your computer" onClick={() => importRef.current?.click()} />
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />
            <ActionButton icon={ExternalLink} label="Open" disabled={!only} onClick={() => only && open(only)} />
            <ActionButton icon={Pencil} label="Rename" title="Rename (F2)" disabled={!only} onClick={() => only && setRenaming(only.id)} />
            <ActionButton icon={Copy} label="Copy" title="Copy (Ctrl+C)" disabled={selectedNodes.length === 0} onClick={() => copySelected("copy")} />
            <ActionButton icon={Scissors} label="Cut" title="Cut (Ctrl+X)" disabled={selectedNodes.length === 0} onClick={() => copySelected("cut")} />
            <ActionButton icon={ClipboardPaste} label="Paste" title="Paste (Ctrl+V)" disabled={!clipboard} onClick={paste} />
            <ActionButton icon={Trash2} label="Delete" title="Move to Trash (Delete)" disabled={selectedNodes.length === 0} onClick={() => trashSelected()} />
            <ActionButton icon={Download} label="Export" title="Export to your computer" disabled={selectedNodes.length === 0} onClick={() => void exportNodes(selectedNodes)} />
          </>
        )}
        <input
          ref={importRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose files to import"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void importFiles(files);
          }}
        />
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Places */}
        <nav aria-label="Places" className="hidden w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-muted/30 p-2 @xl:flex">
          {[...PLACES, { id: TRASH_ID, label: "Trash", icon: Trash2 }].map((p) => (
            <PlaceButton key={p.id} place={p} active={location === p.id} badge={p.id === TRASH_ID && fs.trashCount() > 0 ? fs.trashCount() : undefined} onGo={() => go(p.id)} onDropIds={(ids) => p.id !== TRASH_ID && moveInto(ids, p.id)} readDragIds={readDragIds} />
          ))}
        </nav>

        {/* File area */}
        <div
          ref={listRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onClick={() => {
            setSelection([]);
            setRenaming(null);
          }}
          {...backgroundMenuProps}
          aria-label={`Contents of ${crumbs[crumbs.length - 1]?.label ?? "folder"}`}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
        >
          {entries.length === 0 ? (
            <EmptyState searching={searching} query={query} inTrash={inTrash} />
          ) : prefs.view === "list" ? (
            <FileListView {...viewProps} />
          ) : (
            <FileGridView {...viewProps} />
          )}
          {dragOverFiles && (
            <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary" aria-hidden>
              Drop to import into {here.id === HOME_ID ? "Home" : here.name}
            </div>
          )}
        </div>

        <PreviewPane
          fs={fs}
          nodes={selectedNodes}
          folder={here}
          folderCount={entries.length}
          onOpen={open}
          onExport={(nodes) => void exportNodes(nodes)}
          {...(inTrash ? { disabledReason: "Restore items from the Trash to open them." } : {})}
        />
      </div>

      {/* Status bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 py-1 text-xs text-muted-foreground" role="status" aria-live="polite">
        <span data-testid="explorer-status">
          {entries.length} {entries.length === 1 ? "item" : "items"}
          {selectedNodes.length > 0 && ` · ${selectedNodes.length} selected${totalSelectedBytes ? ` (${formatBytes(totalSelectedBytes)})` : ""}`}
        </span>
        <span className="truncate text-right" title="These files live in this browser only, separate from the files on your computer.">
          Virtual files · stored in this browser{fs.persistent ? "" : " (not saved!)"}
        </span>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, disabled, title }: { icon: LucideIcon; label: string; onClick: (e: MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; title?: string }) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick} {...(disabled !== undefined ? { disabled } : {})} title={title ?? label} aria-label={label} className="shrink-0 px-2">
      <Icon aria-hidden />
      <span className="hidden @2xl:inline">{label}</span>
    </Button>
  );
}

function PlaceButton({
  place,
  active,
  badge,
  onGo,
  onDropIds,
  readDragIds,
}: {
  place: { id: string; label: string; icon: LucideIcon };
  active: boolean;
  badge: number | undefined;
  onGo: () => void;
  onDropIds: (ids: string[]) => void;
  readDragIds: (e: DragEvent) => string[];
}) {
  const [over, setOver] = useState(false);
  const Icon = place.icon;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onGo}
      onDragOver={(e) => {
        if (place.id === TRASH_ID) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (place.id === TRASH_ID) return;
        e.preventDefault();
        onDropIds(readDragIds(e));
      }}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        over && "ring-2 ring-primary",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{place.label}</span>
      {badge !== undefined && <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{badge}</span>}
    </button>
  );
}

function EmptyState({ searching, query, inTrash }: { searching: boolean; query: string; inTrash: boolean }) {
  return (
    <div className="grid flex-1 place-items-center p-6 text-center" role="status">
      <div className="max-w-xs space-y-2">
        {inTrash ? <Trash2 className="mx-auto size-10 text-muted-foreground" aria-hidden /> : <FolderOpen className="mx-auto size-10 text-muted-foreground" aria-hidden />}
        <p className="text-sm font-semibold">{searching ? `Nothing found for “${query.trim()}”` : inTrash ? "The Trash is empty" : "This folder is empty"}</p>
        <p className="text-xs text-muted-foreground">
          {searching ? "Try a different name." : inTrash ? "Deleted files show up here until you remove them for good." : "Create something with New, or drag files here from your computer."}
        </p>
      </div>
    </div>
  );
}
