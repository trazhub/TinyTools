"use client";

import { useEffect, useRef } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { FileIcon } from "../../filesystem/file-icon";
import { PREVIEWABLE_IMAGES, fileKind, kindLabel } from "../../filesystem/mime";
import type { FsNode } from "../../filesystem/types";
import type { VirtualFileSystem } from "../../filesystem/vfs";
import { MarkdownView } from "../../lib/markdown-view";
import { formatDate } from "./file-views";

const TEXT_PREVIEW_LIMIT = 20_000;

/** Shows an image from a Blob. The object URL is created and released with the element. */
function BlobImage({ blob, alt }: { blob: Blob; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  // eslint-disable-next-line @next/next/no-img-element -- local blob: URL, not optimisable by next/image
  return <img ref={ref} alt={alt} className="max-h-48 w-full rounded-lg border border-border bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] object-contain" />;
}

interface PreviewProps {
  fs: VirtualFileSystem;
  nodes: FsNode[];
  folder: FsNode;
  folderCount: number;
  onOpen: (node: FsNode) => void;
  onExport: (nodes: FsNode[]) => void;
  disabledReason?: string;
}

export function PreviewPane({ fs, nodes, folder, folderCount, onOpen, onExport, disabledReason }: PreviewProps) {
  if (nodes.length > 1) {
    const total = nodes.reduce((n, x) => n + (x.kind === "file" ? x.size : 0), 0);
    return (
      <Pane>
        <p className="text-sm font-medium">{nodes.length} items selected</p>
        <p className="text-xs text-muted-foreground">{formatBytes(total)} in files</p>
        <Button size="sm" variant="outline" onClick={() => onExport(nodes)} disabled={!!disabledReason}>
          <Download aria-hidden /> Export as ZIP
        </Button>
      </Pane>
    );
  }

  const node = nodes[0];
  if (!node) {
    return (
      <Pane>
        <FileIcon node={folder} size={44} />
        <p className="break-words text-sm font-medium">{folder.id === "root" ? "Computer" : folder.name}</p>
        <p className="text-xs text-muted-foreground">
          {folderCount} {folderCount === 1 ? "item" : "items"}
        </p>
        <p className="text-xs text-muted-foreground">Select a file to preview it.</p>
      </Pane>
    );
  }

  const kind = fileKind(node);
  const text = kind === "markdown" || kind === "text" || kind === "code" ? fs.readText(node.id) : null;
  const blob = kind === "image" && PREVIEWABLE_IMAGES.includes(node.mime) ? fs.readBlob(node.id) : undefined;

  return (
    <Pane>
      {blob ? <BlobImage key={`${node.id}:${node.modifiedAt}`} blob={blob} alt={`Preview of ${node.name}`} /> : text?.ok ? (
        <div className="max-h-56 w-full overflow-auto rounded-lg border border-border bg-background p-2.5 text-left" data-testid="text-preview">
          {kind === "markdown" ? (
            <MarkdownView source={text.value.slice(0, TEXT_PREVIEW_LIMIT)} className="text-xs" />
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">{text.value.slice(0, TEXT_PREVIEW_LIMIT)}</pre>
          )}
          {text.value.length > TEXT_PREVIEW_LIMIT && <p className="mt-2 text-[11px] italic text-muted-foreground">Preview truncated.</p>}
        </div>
      ) : (
        <FileIcon node={node} size={48} />
      )}

      <p className="break-words text-sm font-semibold">{node.name}</p>
      <dl className="grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left text-xs">
        <dt className="text-muted-foreground">Type</dt>
        <dd>{kindLabel(node)}</dd>
        {node.kind === "file" && (
          <>
            <dt className="text-muted-foreground">Size</dt>
            <dd>{formatBytes(node.size)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Modified</dt>
        <dd>{formatDate(node.modifiedAt)}</dd>
        <dt className="text-muted-foreground">Location</dt>
        <dd className="break-all">{fs.pathOf(node.id)}</dd>
      </dl>
      {!blob && !text?.ok && node.kind === "file" && <p className="text-xs text-muted-foreground">No preview for this kind of file. You can still export it.</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onOpen(node)} disabled={!!disabledReason}>
          <ExternalLink aria-hidden /> Open
        </Button>
        <Button size="sm" variant="outline" onClick={() => onExport([node])}>
          <Download aria-hidden /> Export
        </Button>
      </div>
      {disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
    </Pane>
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <aside aria-label="Preview" className="hidden w-64 shrink-0 flex-col items-center gap-3 overflow-y-auto border-l border-border bg-muted/20 p-4 text-center @3xl:flex">
      {children}
    </aside>
  );
}
