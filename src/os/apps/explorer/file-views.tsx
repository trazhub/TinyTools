"use client";

import { useEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { FileIcon } from "../../filesystem/file-icon";
import { kindLabel } from "../../filesystem/mime";
import type { FsNode } from "../../filesystem/types";
import type { MenuItem } from "../../system/menus";
import { useContextMenu } from "../../system/use-context-menu";
import { SORT_LABELS, type SortKey, type SortSpec } from "./model";

export interface Entry {
  node: FsNode;
  /** Shown in search results (where the item lives) and in the Trash (where it came from). */
  location?: string;
}

export const DRAG_TYPE = "application/x-tinytools-items";

export interface ViewProps {
  entries: Entry[];
  selection: ReadonlySet<string>;
  cutIds: ReadonlySet<string>;
  renaming: string | null;
  sort: SortSpec;
  inTrash: boolean;
  showLocation: boolean;
  getMenu: (node: FsNode) => MenuItem[];
  onSortChange: (key: SortKey) => void;
  onClick: (e: MouseEvent, node: FsNode, touch: boolean) => void;
  onOpen: (node: FsNode) => void;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onDragStart: (e: DragEvent, node: FsNode) => void;
  onDropOn: (e: DragEvent, folder: FsNode) => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const formatDate = (ms: number) => dateFormat.format(new Date(ms));

/** Inline rename field: Enter saves, Escape cancels, clicking away saves. */
function RenameField({ node, onRename, onCancel }: { node: FsNode; onRename: (id: string, name: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const dot = node.kind === "file" ? el.value.lastIndexOf(".") : -1;
    el.setSelectionRange(0, dot > 0 ? dot : el.value.length);
  }, [node.kind]);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit && ref.current) onRename(node.id, ref.current.value);
    else onCancel();
  };

  return (
    <input
      ref={ref}
      defaultValue={node.name}
      aria-label={`New name for ${node.name}`}
      spellCheck={false}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
      className="h-6 w-full min-w-0 rounded border border-ring bg-background px-1.5 text-[13px] outline-none"
    />
  );
}

interface ItemShellProps {
  node: FsNode;
  props: ViewProps;
  className: string;
  children: (renameField: ReactNode | null) => ReactNode;
}

/** Shared behaviour of a row or tile: selection, opening, drag and drop, and the context menu. */
function ItemShell({ node, props: v, className, children }: ItemShellProps) {
  const { props: menuProps, consumeLongPress } = useContextMenu(() => v.getMenu(node), { stopPropagation: true });
  const pointerType = useRef("mouse");
  const [dropTarget, setDropTarget] = useState(false);
  const selected = v.selection.has(node.id);
  const isFolder = node.kind === "dir";
  const canDrop = isFolder && !v.inTrash;

  return (
    <div
      role="option"
      aria-selected={selected}
      data-node-id={node.id}
      data-selected={selected}
      tabIndex={-1}
      draggable={v.renaming !== node.id && !v.inTrash}
      onPointerDown={(e) => {
        pointerType.current = e.pointerType;
        menuProps.onPointerDown(e);
      }}
      onPointerMove={menuProps.onPointerMove}
      onPointerUp={menuProps.onPointerUp}
      onPointerCancel={menuProps.onPointerCancel}
      onContextMenu={menuProps.onContextMenu}
      onClick={(e) => {
        e.stopPropagation();
        if (consumeLongPress()) return;
        v.onClick(e, node, pointerType.current === "touch");
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        v.onOpen(node);
      }}
      onDragStart={(e) => v.onDragStart(e, node)}
      onDragOver={(e) => {
        if (!canDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(e) => {
        setDropTarget(false);
        if (canDrop) {
          e.preventDefault();
          e.stopPropagation();
          v.onDropOn(e, node);
        }
      }}
      className={cn(className, selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/70", dropTarget && "ring-2 ring-primary", v.cutIds.has(node.id) && "opacity-50")}
    >
      {children(v.renaming === node.id ? <RenameField node={node} onRename={v.onRename} onCancel={v.onCancelRename} /> : null)}
    </div>
  );
}

export function FileListView(v: ViewProps) {
  const header = (key: SortKey, label: string, className?: string) => (
    <button
      type="button"
      onClick={() => v.onSortChange(key)}
      aria-label={`Sort by ${SORT_LABELS[key]}`}
      className={cn("flex items-center gap-1 px-2 py-1.5 text-left hover:text-foreground", className)}
    >
      {label}
      {v.sort.key === key && (v.sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
    </button>
  );

  return (
    <div className="@container flex min-h-0 flex-1 flex-col" data-view="list">
      <div className="hidden shrink-0 border-b border-border text-xs font-medium text-muted-foreground @lg:grid @lg:grid-cols-[minmax(0,1fr)_150px_120px_80px]">
        {header("name", "Name", "pl-9")}
        {header("modified", v.inTrash ? "Deleted" : "Date modified")}
        {header("type", "Type")}
        {header("size", "Size", "justify-end")}
      </div>
      <div role="listbox" aria-multiselectable aria-label="Files and folders" className="min-h-0 flex-1 overflow-y-auto p-1">
        {v.entries.map((entry) => {
          const { node } = entry;
          return (
            <ItemShell
              key={node.id}
              node={node}
              props={v}
              className="grid grid-cols-[minmax(0,1fr)_80px] items-center rounded-md px-1 py-1 text-[13px] @lg:grid-cols-[minmax(0,1fr)_150px_120px_80px]"
            >
              {(rename) => (
                <>
                  <div className="flex min-w-0 items-center gap-2.5 px-1">
                    <FileIcon node={node} size={20} />
                    <div className="min-w-0 flex-1">
                      {rename ?? <span className="block truncate">{node.name}</span>}
                      {v.showLocation && entry.location && <span className="block truncate text-[11px] text-muted-foreground">{entry.location}</span>}
                    </div>
                  </div>
                  <span className="hidden truncate px-2 text-xs text-muted-foreground @lg:block">{formatDate(v.inTrash && node.trash ? node.trash.at : node.modifiedAt)}</span>
                  <span className="hidden truncate px-2 text-xs text-muted-foreground @lg:block">{kindLabel(node)}</span>
                  <span className="px-2 text-right text-xs tabular-nums text-muted-foreground">{node.kind === "dir" ? "" : formatBytes(node.size)}</span>
                </>
              )}
            </ItemShell>
          );
        })}
      </div>
    </div>
  );
}

export function FileGridView(v: ViewProps) {
  return (
    <div role="listbox" aria-multiselectable aria-label="Files and folders" data-view="grid" className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] content-start gap-1 overflow-y-auto p-2">
      {v.entries.map(({ node, location }) => (
        <ItemShell key={node.id} node={node} props={v} className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-center">
          {(rename) => (
            <>
              <FileIcon node={node} size={44} />
              <div className="w-full min-w-0">
                {rename ?? <span className="line-clamp-2 break-words text-[12px] leading-tight">{node.name}</span>}
                {v.showLocation && location && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{location}</span>}
              </div>
            </>
          )}
        </ItemShell>
      ))}
    </div>
  );
}
