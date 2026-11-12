"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Columns2, Eye, FilePlus2, Pencil, Search, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { isTextMime } from "../../filesystem/mime";
import { NOTES_ID, type FsNode } from "../../filesystem/types";
import { MarkdownView } from "../../lib/markdown-view";
import { useFsVersion, useKernel, useWindowTitle } from "../../system/kernel-context";
import type { AppComponentProps } from "../types";

type Mode = "edit" | "preview" | "split";
const SAVE_DELAY_MS = 500;

export default function NotesApp({ windowId, props }: AppComponentProps) {
  const kernel = useKernel();
  const { fs } = kernel;
  useFsVersion();

  const requested = typeof props.nodeId === "string" ? props.nodeId : null;
  const [selectedId, setSelectedId] = useState<string | null>(requested);
  const [seenRequest, setSeenRequest] = useState(requested);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("edit");

  // Re-opening Notes with a different file (e.g. from File Explorer) switches to it.
  if (requested !== seenRequest) {
    setSeenRequest(requested);
    if (requested) setSelectedId(requested);
  }

  const notes = fs
    .list(NOTES_ID)
    .filter((n) => n.kind === "file" && isTextMime(n.mime))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);

  // A file opened from elsewhere is shown at the top of the list even if it isn't in the Notes folder.
  const opened = selectedId ? fs.get(selectedId) : undefined;
  const validOpened = opened && opened.kind === "file" && !fs.isInTrash(opened.id) ? opened : undefined;
  const list = validOpened && !notes.some((n) => n.id === validOpened.id) ? [validOpened, ...notes] : notes;

  const q = query.trim().toLowerCase();
  const visible = q
    ? list.filter((n) => {
        if (n.name.toLowerCase().includes(q)) return true;
        const text = fs.readText(n.id);
        return text.ok && text.value.toLowerCase().includes(q);
      })
    : list;

  const current = validOpened ?? undefined;
  useWindowTitle(windowId, current ? `${current.name} · Notes` : "Notes");

  const createNote = () => {
    const name = fs.uniqueName(NOTES_ID, "Untitled note.md");
    const r = fs.createFile(NOTES_ID, name, "# Untitled note\n\n");
    if (r.ok) {
      setSelectedId(r.value.id);
      setQuery("");
      setMode("edit");
    } else {
      kernel.notify({ tone: "error", title: "Couldn't create the note", message: r.error });
    }
  };

  const renameNote = async (node: FsNode) => {
    const name = await kernel.prompt({ title: "Rename note", label: "Name", initial: node.name, confirmLabel: "Rename", selectBaseName: true });
    if (name === null) return;
    const r = fs.rename(node.id, name);
    if (!r.ok) kernel.notify({ tone: "error", title: "Couldn't rename", message: r.error });
  };

  const deleteNote = async (node: FsNode) => {
    const ok = await kernel.confirm({
      title: `Move “${node.name}” to the Trash?`,
      message: "You can restore it later from the Trash in File Explorer.",
      confirmLabel: "Move to Trash",
      danger: true,
    });
    if (!ok) return;
    const r = fs.trash(node.id);
    if (!r.ok) return kernel.notify({ tone: "error", title: "Couldn't delete", message: r.error });
    setSelectedId(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      createNote();
    } else if (e.altKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      setMode((m) => (m === "edit" ? "preview" : "edit"));
    }
  };

  return (
    <div className="@container flex h-full" onKeyDown={onKeyDown} data-testid="notes">
      <aside aria-label="Notes list" className="flex w-48 shrink-0 flex-col border-r border-border bg-muted/30 @2xl:w-60">
        <div className="space-y-2 p-2">
          <Button className="w-full" size="sm" onClick={createNote} title="New note (Alt+N)">
            <FilePlus2 aria-hidden /> New note
          </Button>
          <label className="relative block">
            <span className="sr-only">Search notes</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes"
              className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2" aria-label="Notes">
          {visible.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                aria-current={current?.id === n.id}
                onClick={() => setSelectedId(n.id)}
                className={cn("w-full rounded-lg px-2.5 py-2 text-left transition-colors", current?.id === n.id ? "bg-accent text-accent-foreground" : "hover:bg-muted")}
              >
                <span className="block truncate text-[13px] font-medium">{n.name.replace(/\.(md|txt)$/i, "")}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{new Date(n.modifiedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li role="status" className="px-3 py-6 text-center text-xs text-muted-foreground">
              {q ? `No notes match “${query.trim()}”.` : "No notes yet."}
            </li>
          )}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col" aria-label="Editor">
        {current ? (
          <Editor key={current.id} node={current} mode={mode} setMode={setMode} onRename={() => renameNote(current)} onDelete={() => deleteNote(current)} />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div className="max-w-xs space-y-3">
              <SquarePen className="mx-auto size-10 text-muted-foreground" aria-hidden />
              <h2 className="text-base font-semibold">{notes.length === 0 ? "Write your first note" : "Pick a note to start"}</h2>
              <p className="text-sm text-muted-foreground">Notes are saved automatically in this browser. You can write in Markdown and preview it.</p>
              <Button onClick={createNote}>
                <FilePlus2 aria-hidden /> New note
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

interface EditorProps {
  node: FsNode;
  mode: Mode;
  setMode: (m: Mode) => void;
  onRename: () => void;
  onDelete: () => void;
}

/** Edits one file. It is keyed by file id, so switching notes remounts it and flushes any pending save. */
function Editor({ node, mode, setMode, onRename, onDelete }: EditorProps) {
  const { fs } = useKernel();
  const fsText = fs.readText(node.id);
  const stored = fsText.ok ? fsText.value : "";
  const [draft, setDraft] = useState(stored);
  const [dirty, setDirty] = useState(false);
  const latest = useRef({ draft, dirty });
  const fsRef = useRef(fs);

  // Pick up changes made elsewhere (for example `echo hi >> note.md` in the Terminal) when we have no unsaved edits.
  if (!dirty && fsText.ok && fsText.value !== draft) setDraft(fsText.value);

  useEffect(() => {
    latest.current = { draft, dirty };
  });

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      fsRef.current.writeText(node.id, draft);
      setDirty(false);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dirty, draft, node.id]);

  // Never lose edits: save when leaving the note, hiding the tab or closing the page.
  useEffect(() => {
    const store = fsRef.current;
    const flush = () => {
      const { draft: d, dirty: isDirty } = latest.current;
      if (isDirty) store.writeText(node.id, d);
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [node.id]);

  const saveNow = () => {
    if (!dirty) return;
    fs.writeText(node.id, draft);
    setDirty(false);
  };

  const words = useMemo(() => (draft.trim() ? draft.trim().split(/\s+/).length : 0), [draft]);
  const isMarkdown = node.mime === "text/markdown";

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={node.name}>
          {node.name}
        </h2>
        {isMarkdown && (
          <Segmented<Mode>
            label="View"
            value={mode}
            onChange={setMode}
            options={[
              { value: "edit", label: "Edit" },
              { value: "preview", label: "Preview" },
              { value: "split", label: "Split" },
            ]}
          />
        )}
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Rename note" title="Rename" onClick={onRename}>
            <Pencil aria-hidden />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Move note to Trash" title="Move to Trash" onClick={onDelete}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>

      <div className={cn("grid min-h-0 flex-1", isMarkdown && mode === "split" ? "grid-cols-2 divide-x divide-border" : "grid-cols-1")}>
        {(!isMarkdown || mode !== "preview") && (
          <textarea
            aria-label={`Contents of ${node.name}`}
            value={draft}
            spellCheck
            onChange={(e) => {
              setDraft(e.target.value);
              setDirty(true);
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                saveNow();
              }
            }}
            placeholder="Start typing…"
            className="min-h-0 resize-none bg-transparent p-4 font-mono text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground"
          />
        )}
        {isMarkdown && mode !== "edit" && (
          <div className="min-h-0 overflow-y-auto p-4" data-testid="note-preview" aria-label="Preview">
            {draft.trim() ? <MarkdownView source={draft} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
        <span>{dirty ? "Saving…" : "Saved"}</span>
        <span className="flex items-center gap-3">
          {isMarkdown && mode === "split" && <Columns2 className="size-3.5" aria-hidden />}
          {isMarkdown && mode === "preview" && <Eye className="size-3.5" aria-hidden />}
          {words} {words === 1 ? "word" : "words"} · {draft.length} characters
        </span>
      </div>
    </>
  );
}
