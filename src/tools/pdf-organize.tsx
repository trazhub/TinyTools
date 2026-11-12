"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Download, Loader2, RotateCw, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { baseName, errorMessage } from "./shared";
import { ResultCard } from "./result-card";
import { loadPdfLib, pickPages, pdfBlob } from "./pdf-utils";
import { openPdf, renderPage } from "./pdf-render";

const MAX_PAGES = 150;

interface Tile {
  id: number; // original page number (1-based)
  thumb: string;
  turn: number; // extra rotation in degrees
}

/** See every page as a small picture; reorder, rotate or delete pages, then save. */
export default function PdfOrganize() {
  const [file, setFile] = useState<File | null>(null);
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  async function pick([f]: File[]) {
    setResult(null);
    if (!f) return;
    setFile(f);
    setTiles(null);
    setError(null);
    setLoading(true);
    try {
      const doc = await openPdf(f);
      if (doc.numPages > MAX_PAGES) throw new Error(`This tool handles up to ${MAX_PAGES} pages. Use Split PDF first.`);
      const list: Tile[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const canvas = await renderPage(doc, i, 0.3);
        list.push({ id: i, thumb: canvas.toDataURL("image/jpeg", 0.7), turn: 0 });
        setTiles([...list]);
      }
    } catch (e) {
      setFile(null);
      setTiles(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const update = (fn: (t: Tile[]) => Tile[]) => setTiles((t) => (t ? fn(t) : t));
  const move = (i: number, d: -1 | 1) =>
    update((t) => {
      const next = [...t];
      const a = next[i];
      const b = next[i + d];
      if (a && b) [next[i], next[i + d]] = [b, a];
      return next;
    });

  async function save() {
    if (!file || !tiles) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const { degrees } = await import("pdf-lib");
      const src = await loadPdfLib(file);
      const out = await pickPages(src, tiles.map((t) => t.id));
      tiles.forEach((t, i) => {
        if (t.turn) {
          const page = out.getPage(i);
          page.setRotation(degrees((page.getRotation().angle + t.turn) % 360));
        }
      });
      setResult({ blob: await pdfBlob(out), name: `${baseName(file.name)}-organized.pdf` });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone accept="application/pdf,.pdf" hint="A PDF up to 150 pages. Nothing is uploaded." onFiles={pick} />
      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading pages… {tiles?.length ?? 0}
        </p>
      )}
      {tiles && tiles.length > 0 && (
        <div className="space-y-5">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {tiles.map((t, i) => (
              <li key={t.id} className="border border-foreground p-2">
                <div className="flex h-36 items-center justify-center overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.thumb} alt={`Page ${t.id}`} className="max-h-full max-w-full transition-transform" style={{ transform: `rotate(${t.turn}deg)` }} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {i + 1} (was {t.id})
                  </span>
                  <span className="flex">
                    <Button variant="ghost" size="icon-sm" aria-label={`Move page ${t.id} earlier`} disabled={i === 0 || loading} onClick={() => move(i, -1)}>
                      <ArrowLeft aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Move page ${t.id} later`} disabled={i === tiles.length - 1 || loading} onClick={() => move(i, 1)}>
                      <ArrowRight aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Rotate page ${t.id}`} onClick={() => update((l) => l.map((x) => (x.id === t.id ? { ...x, turn: (x.turn + 90) % 360 } : x)))}>
                      <RotateCw aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete page ${t.id}`} onClick={() => update((l) => l.filter((x) => x.id !== t.id))}>
                      <X aria-hidden />
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Button onClick={save} disabled={busy || loading}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {busy ? "Saving…" : "Save PDF"}
          </Button>
        </div>
      )}
      {tiles && tiles.length === 0 && <Alert tone="info">Every page was deleted. Choose the file again to start over.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {result && <ResultCard blob={result.blob} name={result.name} />}
    </div>
  );
}
