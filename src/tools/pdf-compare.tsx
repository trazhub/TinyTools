"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { errorMessage } from "./shared";
import { openPdf, renderPage } from "./pdf-render";

const MAX_PAGES = 20;
const WIDTH = 700; // compare at this width in pixels

interface PageResult {
  page: number;
  percent: number;
  a: string;
  b: string;
  diff: string;
}

async function drawAt(doc: Awaited<ReturnType<typeof openPdf>>, n: number): Promise<HTMLCanvasElement> {
  const base = (await doc.getPage(n)).getViewport({ scale: 1 });
  return renderPage(doc, n, WIDTH / base.width);
}

/** Show two versions of a PDF side by side, with the changed parts of each page marked in black. */
export default function PdfCompare() {
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [results, setResults] = useState<PageResult[] | null>(null);

  async function run() {
    if (!a || !b) return;
    setError(null);
    setNote(null);
    setResults(null);
    setBusy(true);
    try {
      const [da, db] = await Promise.all([openPdf(a), openPdf(b)]);
      const count = Math.min(da.numPages, db.numPages, MAX_PAGES);
      const notes: string[] = [];
      if (da.numPages !== db.numPages) notes.push(`The PDFs have different page counts (${da.numPages} and ${db.numPages}), so only the first ${count} pages are compared.`);
      else if (count < da.numPages) notes.push(`Only the first ${MAX_PAGES} pages are compared.`);
      const out: PageResult[] = [];
      for (let n = 1; n <= count; n++) {
        const ca = await drawAt(da, n);
        const cb0 = await drawAt(db, n);
        // Put B on a canvas the size of A so the pixels line up.
        const cb = document.createElement("canvas");
        cb.width = ca.width;
        cb.height = ca.height;
        const cbx = cb.getContext("2d")!;
        cbx.fillStyle = "#fff";
        cbx.fillRect(0, 0, cb.width, cb.height);
        cbx.drawImage(cb0, 0, 0, cb.width, cb.height);

        const pa = ca.getContext("2d")!.getImageData(0, 0, ca.width, ca.height);
        const pb = cbx.getImageData(0, 0, cb.width, cb.height);
        const diff = document.createElement("canvas");
        diff.width = ca.width;
        diff.height = ca.height;
        const dctx = diff.getContext("2d")!;
        const dd = dctx.createImageData(ca.width, ca.height);
        let changed = 0;
        for (let i = 0; i < pa.data.length; i += 4) {
          const delta = Math.abs(pa.data[i]! - pb.data[i]!) + Math.abs(pa.data[i + 1]! - pb.data[i + 1]!) + Math.abs(pa.data[i + 2]! - pb.data[i + 2]!);
          const bad = delta > 90;
          if (bad) changed++;
          // Unchanged: a pale copy of A. Changed: solid black.
          const v = bad ? 0 : 255 - (255 - pa.data[i]!) * 0.25;
          dd.data[i] = dd.data[i + 1] = dd.data[i + 2] = v;
          dd.data[i + 3] = 255;
        }
        dctx.putImageData(dd, 0, 0);
        out.push({ page: n, percent: (changed / (pa.data.length / 4)) * 100, a: ca.toDataURL("image/jpeg", 0.7), b: cb.toDataURL("image/jpeg", 0.7), diff: diff.toDataURL("image/png") });
        setResults([...out]);
      }
      setNote(notes.join(" ") || null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Original</p>
          <FileDropzone accept="application/pdf,.pdf" title={a ? a.name : "Choose the first PDF"} hint="Nothing is uploaded." onFiles={([f]) => f && (setA(f), setResults(null))} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Changed version</p>
          <FileDropzone accept="application/pdf,.pdf" title={b ? b.name : "Choose the second PDF"} hint="Nothing is uploaded." onFiles={([f]) => f && (setB(f), setResults(null))} />
        </div>
      </div>
      <Button onClick={run} disabled={busy || !a || !b}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {busy ? "Comparing…" : "Compare"}
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
      {note && <Alert tone="info">{note}</Alert>}
      {results && (
        <div className="space-y-8">
          {results.map((r) => (
            <section key={r.page} className="space-y-2">
              <h2 className="text-sm font-medium">
                Page {r.page}: {r.percent < 0.005 ? "no differences" : `${r.percent.toFixed(2)}% changed`}
              </h2>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["Original", r.a],
                  ["Changed version", r.b],
                  ["Differences", r.diff],
                ].map(([label, src]) => (
                  <figure key={label} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${label}, page ${r.page}`} className="w-full border border-foreground" />
                    <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
