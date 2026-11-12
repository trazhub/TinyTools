"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { baseName, canvasToBlob, errorMessage } from "./shared";
import { loadPdfLib, savePdf } from "./pdf-utils";
import { openPdf, renderPage, safeScale } from "./pdf-render";
import { PageNav, PagePreview, type Rect } from "./pdf-preview";

type Doc = Awaited<ReturnType<typeof openPdf>>;

/**
 * Black out parts of a page. Pages with black boxes are redrawn as pictures with the boxes
 * burnt in, so the hidden text is gone from the file (not just covered). Other pages are kept as they are.
 */
export default function PdfRedact() {
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [page, setPage] = useState(1);
  const [boxes, setBoxes] = useState<Record<number, Rect[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick([f]: File[]) {
    if (!f) return;
    setError(null);
    setBoxes({});
    setPage(1);
    try {
      setDoc(await openPdf(f));
      setFile(f);
    } catch (e) {
      setDoc(null);
      setFile(null);
      setError(errorMessage(e));
    }
  }

  async function save() {
    if (!file || !doc) return;
    setError(null);
    setBusy(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const src = await loadPdfLib(file);
      const out = await PDFDocument.create();
      for (let n = 1; n <= doc.numPages; n++) {
        const list = boxes[n];
        if (!list || list.length === 0) {
          const [copied] = await out.copyPages(src, [n - 1]);
          if (copied) out.addPage(copied);
          continue;
        }
        const size = (await doc.getPage(n)).getViewport({ scale: 1 });
        const canvas = await renderPage(doc, n, safeScale(size.width, size.height, 2));
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#000";
        for (const r of list) ctx.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
        const img = await out.embedJpg(new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", 0.92)).arrayBuffer()));
        out.addPage([size.width, size.height]).drawImage(img, { x: 0, y: 0, width: size.width, height: size.height });
      }
      await savePdf(out, `${baseName(file.name)}-redacted.pdf`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const total = doc?.numPages ?? 0;
  const here = boxes[page] ?? [];
  const count = Object.values(boxes).reduce((n, l) => n + l.length, 0);

  return (
    <div className="space-y-6">
      <FileDropzone accept="application/pdf,.pdf" hint="A PDF. Nothing is uploaded." onFiles={pick} />
      {doc && file && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">Drag on the page to draw black boxes over what you want to hide.</p>
          <PageNav page={page} total={total} onPage={setPage} />
          <PagePreview doc={doc} pageNumber={page} onRect={(r) => setBoxes((b) => ({ ...b, [page]: [...(b[page] ?? []), r] }))}>
            {here.map((r, i) => (
              <div key={i} className="pointer-events-none absolute bg-black" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }} />
            ))}
          </PagePreview>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              {count} box{count === 1 ? "" : "es"} in total, {here.length} on this page
            </span>
            <Button variant="outline" size="sm" disabled={here.length === 0} onClick={() => setBoxes((b) => ({ ...b, [page]: (b[page] ?? []).slice(0, -1) }))}>
              Undo last box
            </Button>
          </div>
          <Alert tone="info">Pages with black boxes become pictures, so the text under the boxes is gone for good. Other pages stay unchanged.</Alert>
          <Button onClick={save} disabled={busy || count === 0}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {busy ? "Redacting…" : "Redact and save"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
