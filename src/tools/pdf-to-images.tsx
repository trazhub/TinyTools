"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { baseName, canvasToBlob, errorMessage } from "./shared";
import { ResultList, type ResultFile } from "./result-card";
import { openPdf, renderPage, safeScale } from "./pdf-render";

const FORMATS = [
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPG" },
] as const;
const QUALITY = [
  { value: "1", label: "Normal (72 dpi)" },
  { value: "2", label: "Sharp (144 dpi)" },
  { value: "3", label: "Print (216 dpi)" },
] as const;

export default function PdfToImages() {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<string>("image/png");
  const [quality, setQuality] = useState<string>("2");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ResultFile[] | null>(null);

  async function run() {
    if (!file) return;
    setError(null);
    setImages(null);
    try {
      setProgress("Opening…");
      const doc = await openPdf(file);
      const ext = type === "image/png" ? "png" : "jpg";
      const name = baseName(file.name);
      const pad = String(doc.numPages).length;
      const made: ResultFile[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        setProgress(`Page ${i} of ${doc.numPages}…`);
        const first = await doc.getPage(i);
        const v = first.getViewport({ scale: 1 });
        const canvas = await renderPage(doc, i, safeScale(v.width, v.height, Number(quality)));
        made.push({
          name: `${name}-${String(i).padStart(pad, "0")}.${ext}`,
          blob: await canvasToBlob(canvas, type, 0.92),
          info: `${canvas.width} × ${canvas.height} px`,
        });
        setImages([...made]);
      }
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
          setImages(null);
          setError(null);
        }}
      />
      {file && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">{file.name}</p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Image format</p>
            <Segmented label="Image format" value={type} onChange={setType} options={FORMATS} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Quality</p>
            <Segmented label="Quality" value={quality} onChange={setQuality} options={QUALITY} />
          </div>
          <Button onClick={run} disabled={progress !== null}>
            {progress ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {progress ?? "Convert"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {images && <ResultList files={images} zipName={`${baseName(file?.name ?? "pages")}-pages.zip`} />}
    </div>
  );
}
