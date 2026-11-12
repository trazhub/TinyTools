"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { downloadBlob } from "@/lib/utils";
import { baseName, canvasToBlob, errorMessage } from "./shared";
import { openPdf, renderPage, safeScale } from "./pdf-render";

const QUALITY = [
  { value: "1.5", label: "Small file" },
  { value: "2", label: "Balanced" },
  { value: "3", label: "Sharp" },
] as const;

/**
 * Every page is drawn, colour-inverted (white paper becomes black, black text becomes white)
 * and put back into a new PDF. The pages become pictures, so text can't be selected afterwards.
 */
export default function PdfDark() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<string>("2");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run() {
    if (!file) return;
    setError(null);
    setDone(null);
    try {
      setProgress("Opening…");
      const doc = await openPdf(file);
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();
      for (let i = 1; i <= doc.numPages; i++) {
        setProgress(`Page ${i} of ${doc.numPages}…`);
        const page = await doc.getPage(i);
        const size = page.getViewport({ scale: 1 });
        const canvas = await renderPage(doc, i, safeScale(size.width, size.height, Number(quality)));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not available in this browser.");
        ctx.globalCompositeOperation = "difference";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const jpg = await out.embedJpg(new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", 0.9)).arrayBuffer()));
        out.addPage([size.width, size.height]).drawImage(jpg, { x: 0, y: 0, width: size.width, height: size.height });
      }
      setProgress("Saving…");
      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)}-dark.pdf`);
      setDone(`Downloaded ${doc.numPages} dark page${doc.numPages === 1 ? "" : "s"}.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        hint="A PDF. Nothing is uploaded."
        onFiles={([f]) => {
          if (!f) return;
          setFile(f);
          setDone(null);
          setError(null);
        }}
      />
      {file && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">{file.name}</p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Quality</p>
            <Segmented label="Quality" value={quality} onChange={setQuality} options={QUALITY} />
          </div>
          <p className="text-sm text-muted-foreground">Colours are inverted, so photos look like negatives. Text in the result can&apos;t be selected.</p>
          <Button onClick={run} disabled={progress !== null}>
            {progress ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {progress ?? "Make it dark"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}
    </div>
  );
}
