"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Download, Loader2, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { formatBytes } from "@/lib/utils";
import { errorMessage } from "./shared";
import { ResultCard } from "./result-card";
import { loadPdfLib, pdfBlob } from "./pdf-utils";

let counter = 0;

export default function PdfMerge() {
  const [items, setItems] = useState<{ id: number; file: File }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  function move(i: number, d: -1 | 1) {
    setItems((list) => {
      const next = [...list];
      const a = next[i];
      const b = next[i + d];
      if (a && b) [next[i], next[i + d]] = [b, a];
      return next;
    });
  }

  async function merge() {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();
      for (const { file } of items) {
        let src;
        try {
          src = await loadPdfLib(file);
        } catch (e) {
          throw new Error(`${file.name}: ${errorMessage(e)}`);
        }
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      }
      setResult({ blob: await pdfBlob(out), name: "merged.pdf" });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        multiple
        hint="Choose two or more PDFs. Nothing is uploaded."
        onFiles={(files) => setItems((l) => [...l, ...files.map((file) => ({ id: ++counter, file }))])}
      />
      {items.length > 0 && (
        <div className="space-y-5">
          <ol className="border-t border-foreground">
            {items.map(({ id, file }, i) => (
              <li key={id} className="flex items-center gap-2 border-b border-foreground py-2 text-sm">
                <span className="w-6 text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${file.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${file.name} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} onClick={() => setItems((l) => l.filter((x) => x.id !== id))}>
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ol>
          <Button onClick={merge} disabled={busy || items.length < 2}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {busy ? "Merging…" : items.length < 2 ? "Add one more PDF" : "Merge PDFs"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {result && <ResultCard blob={result.blob} name={result.name} />}
    </div>
  );
}
