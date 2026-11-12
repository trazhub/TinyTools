"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createZip } from "@/lib/zip";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { openPdf, renderPage } from "./pdf-render";

const MAX_PREVIEW_PAGES = 30;

/** Shows the pages of a PDF (made in the browser) so the result can be checked before saving. */
export function PdfPreview({ blob }: { blob: Blob }) {
  const [pages, setPages] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const doc = await openPdf(new File([blob], "preview.pdf", { type: "application/pdf" }));
        if (dead) return;
        setTotal(doc.numPages);
        const urls: string[] = [];
        for (let i = 1; i <= Math.min(doc.numPages, MAX_PREVIEW_PAGES); i++) {
          const first = await doc.getPage(i);
          const base = first.getViewport({ scale: 1 });
          const canvas = await renderPage(doc, i, Math.min(2, 900 / base.width));
          if (dead) return;
          urls.push(canvas.toDataURL("image/jpeg", 0.8));
          setPages([...urls]);
        }
      } catch {
        if (!dead) setFailed(true);
      }
    })();
    return () => {
      dead = true;
    };
  }, [blob]);

  if (failed) return <p className="text-sm text-muted-foreground">A preview is not available, but the file is ready to download.</p>;
  return (
    <div className="space-y-2">
      <div className="max-h-[32rem] space-y-3 overflow-auto border border-foreground bg-muted p-3">
        {pages.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt={`Page ${i + 1}`} className="mx-auto block w-full max-w-2xl border border-foreground bg-white" />
        ))}
        {pages.length === 0 && <p className="p-4 text-sm text-muted-foreground">Loading preview…</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        {total > MAX_PREVIEW_PAGES ? `Showing the first ${MAX_PREVIEW_PAGES} of ${total} pages.` : total ? `${total} page${total === 1 ? "" : "s"}.` : ""}
      </p>
    </div>
  );
}

/** An address for showing a blob, released when the blob changes. */
export function useBlobUrl(blob: Blob | null): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

/**
 * The result of a tool: a live preview (picture, PDF pages, video or audio player) with the file name,
 * its size and a download button. Files that cannot be shown (such as a zip) get just the details.
 */
export function ResultCard({ blob, name, note, children }: { blob: Blob; name: string; note?: string; children?: ReactNode }) {
  const url = useBlobUrl(blob);
  const type = blob.type;
  return (
    <section className="space-y-3 border border-foreground p-4" aria-label="Result">
      {type.startsWith("image/") && url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Result preview" className="max-h-96 max-w-full border border-border" />
      )}
      {type.startsWith("video/") && url && (
        <video src={url} controls playsInline className="max-h-96 max-w-full border border-foreground bg-black" />
      )}
      {type.startsWith("audio/") && url && <audio src={url} controls className="w-full max-w-xl" />}
      {type === "application/pdf" && <PdfPreview blob={blob} />}
      {type === "application/zip" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileArchive className="size-4" aria-hidden /> A zip file, so there is nothing to preview.
        </p>
      )}
      <p className="text-sm">
        {name}, {formatBytes(blob.size)}
      </p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {children}
      <Button onClick={() => downloadBlob(blob, name)}>
        <Download aria-hidden /> Download
      </Button>
    </section>
  );
}

export interface ResultFile {
  name: string;
  blob: Blob;
  /** Extra detail shown next to the name. */
  info?: string;
}

function Thumb({ blob }: { blob: Blob }) {
  const url = useBlobUrl(blob);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className="size-14 shrink-0 border border-foreground object-cover" /> : null;
}

/**
 * Results with several files: a row for each (picture thumbnail, or a "Preview" button for PDFs),
 * a download for each, and one zip with everything.
 */
export function ResultList({ files, zipName }: { files: ResultFile[]; zipName: string }) {
  const [open, setOpen] = useState<string | null>(null);

  async function zip() {
    const entries = await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })));
    downloadBlob(new Blob([createZip(entries) as BlobPart], { type: "application/zip" }), zipName);
  }

  return (
    <section className="space-y-3" aria-label="Results">
      <ul className="border-t border-foreground">
        {files.map((f) => (
          <li key={f.name} className="space-y-3 border-b border-foreground py-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {f.blob.type.startsWith("image/") && <Thumb blob={f.blob} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.name}</span>
                <span className="text-muted-foreground">
                  {formatBytes(f.blob.size)}
                  {f.info ? `, ${f.info}` : ""}
                </span>
              </span>
              {f.blob.type === "application/pdf" && (
                <Button variant="outline" size="sm" onClick={() => setOpen(open === f.name ? null : f.name)} aria-expanded={open === f.name}>
                  {open === f.name ? "Hide preview" : "Preview"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => downloadBlob(f.blob, f.name)}>
                <Download aria-hidden /> Download
              </Button>
            </div>
            {open === f.name && <PdfPreview blob={f.blob} />}
          </li>
        ))}
      </ul>
      {files.length > 1 && (
        <Button onClick={zip}>
          <FileArchive aria-hidden /> Download all as zip
        </Button>
      )}
    </section>
  );
}
