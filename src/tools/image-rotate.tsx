"use client";

import { useEffect, useState } from "react";
import { Download, FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { formatBytes } from "@/lib/utils";
import { ResultCard } from "./result-card";
import { EXT, OUTPUT_QUALITY, baseName, canvasToBlob, errorMessage, openBitmap } from "./shared";

export default function ImageRotate() {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [turn, setTurn] = useState(0); // 0..3 quarter turns clockwise
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function pick([f]: File[]) {
    if (!f) return;
    setError(null);
    setResult(null);
    setTurn(0);
    setFlipH(false);
    setFlipV(false);
    try {
      setBitmap(await openBitmap(f));
      setFile(f);
      setUrl(URL.createObjectURL(f));
    } catch (e) {
      setFile(null);
      setBitmap(null);
      setUrl(null);
      setError(errorMessage(e));
    }
  }

  async function save() {
    if (!file || !bitmap) return;
    try {
      const sideways = turn % 2 === 1;
      const c = document.createElement("canvas");
      c.width = sideways ? bitmap.height : bitmap.width;
      c.height = sideways ? bitmap.width : bitmap.height;
      const type = file.type in EXT ? file.type : "image/png";
      const ctx = c.getContext("2d")!;
      if (type === "image/jpeg") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
      }
      // Same order as the preview: flip first, then turn.
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((turn * Math.PI) / 2);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      setResult({ blob: await canvasToBlob(c, type, OUTPUT_QUALITY), name: `${baseName(file.name)}-rotated.${EXT[type]}` });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const changed = turn !== 0 || flipH || flipV;

  return (
    <div className="space-y-6">
      <FileDropzone accept="image/*" hint="PNG, JPG or WebP. Nothing is uploaded." onFiles={pick} />
      {error && <Alert tone="error">{error}</Alert>}
      {file && bitmap && url && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {file.name}: {bitmap.width} × {bitmap.height} px, {formatBytes(file.size)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setResult(null); setTurn((t) => (t + 3) % 4); }}>
              <RotateCcw aria-hidden /> Left
            </Button>
            <Button variant="outline" onClick={() => { setResult(null); setTurn((t) => (t + 1) % 4); }}>
              <RotateCw aria-hidden /> Right
            </Button>
            <Button variant="outline" onClick={() => { setResult(null); setFlipH((v) => !v); }} aria-pressed={flipH}>
              <FlipHorizontal2 aria-hidden /> Flip left-right
            </Button>
            <Button variant="outline" onClick={() => { setResult(null); setFlipV((v) => !v); }} aria-pressed={flipV}>
              <FlipVertical2 aria-hidden /> Flip up-down
            </Button>
          </div>
          <div className="flex h-80 items-center justify-center overflow-hidden border border-foreground bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Preview"
              className="max-h-full max-w-full transition-transform"
              style={{ transform: `rotate(${turn * 90}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`, maxHeight: turn % 2 ? "20rem" : undefined, maxWidth: turn % 2 ? "20rem" : undefined }}
            />
          </div>
          <Button onClick={save} disabled={!changed}>
            <Download aria-hidden /> Make the picture
          </Button>
          {result && <ResultCard blob={result.blob} name={result.name} />}
        </div>
      )}
    </div>
  );
}
