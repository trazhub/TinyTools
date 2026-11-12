"use client";

import { useEffect, useRef, useState } from "react";
import { Crop } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { formatBytes } from "@/lib/utils";
import { ResultCard } from "./result-card";
import { EXT, OUTPUT_QUALITY, baseName, canvasToBlob, errorMessage, openBitmap } from "./shared";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const RATIOS = [
  { value: "free", label: "Free" },
  { value: "1", label: "1:1" },
  { value: String(16 / 9), label: "16:9" },
  { value: String(4 / 3), label: "4:3" },
  { value: String(3 / 2), label: "3:2" },
] as const;

export default function ImageCrop() {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [ratio, setRatio] = useState<string>("free");
  const [rect, setRect] = useState<Rect | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function pick([f]: File[]) {
    if (!f) return;
    setError(null);
    setRect(null);
    setResult(null);
    try {
      const b = await openBitmap(f);
      setFile(f);
      setBitmap(b);
      setUrl(URL.createObjectURL(f));
    } catch (e) {
      setFile(null);
      setBitmap(null);
      setUrl(null);
      setError(errorMessage(e));
    }
  }

  const point = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  /** Build a rectangle from the drag start to the pointer, keeping the chosen aspect ratio and staying inside the image. */
  function shape(x0: number, y0: number, x1: number, y1: number): Rect {
    if (ratio === "free" || !bitmap) return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
    const r = Number(ratio);
    const k = bitmap.width / (r * bitmap.height); // fraction of height per fraction of width
    const sx = x1 >= x0 ? 1 : -1;
    const sy = y1 >= y0 ? 1 : -1;
    let w = Math.abs(x1 - x0);
    w = Math.min(w, sx > 0 ? 1 - x0 : x0);
    w = Math.min(w, (sy > 0 ? 1 - y0 : y0) / k);
    const h = w * k;
    return { x: sx > 0 ? x0 : x0 - w, y: sy > 0 ? y0 : y0 - h, w, h };
  }

  async function save() {
    if (!file || !bitmap || !rect) return;
    try {
      const sx = Math.round(rect.x * bitmap.width);
      const sy = Math.round(rect.y * bitmap.height);
      const sw = Math.max(1, Math.round(rect.w * bitmap.width));
      const sh = Math.max(1, Math.round(rect.h * bitmap.height));
      const type = file.type in EXT ? file.type : "image/png";
      const c = document.createElement("canvas");
      c.width = sw;
      c.height = sh;
      const ctx = c.getContext("2d")!;
      if (type === "image/jpeg") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, sw, sh);
      }
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await canvasToBlob(c, type, OUTPUT_QUALITY);
      setResult({ blob, name: `${baseName(file.name)}-cropped.${EXT[type]}` });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const pixels = rect && bitmap ? `${Math.max(1, Math.round(rect.w * bitmap.width))} × ${Math.max(1, Math.round(rect.h * bitmap.height))} px` : null;

  return (
    <div className="space-y-6">
      <FileDropzone accept="image/*" hint="PNG, JPG or WebP. Nothing is uploaded." onFiles={pick} />
      {error && <Alert tone="error">{error}</Alert>}
      {file && bitmap && url && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {file.name}: {bitmap.width} × {bitmap.height} px, {formatBytes(file.size)}
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Shape</p>
            <Segmented label="Shape" value={ratio} onChange={(v) => { setRatio(v); setRect(null); }} options={RATIOS} />
          </div>
          <p className="text-sm text-muted-foreground">Drag on the picture to choose the part to keep.</p>
          <div
            ref={box}
            className="relative inline-block max-w-full touch-none select-none border border-foreground"
            style={{ cursor: "crosshair" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = point(e);
              setDrag({ x0: p.x, y0: p.y });
              setRect(null);
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              const p = point(e);
              setRect(shape(drag.x0, drag.y0, p.x, p.y));
            }}
            onPointerUp={() => {
              setDrag(null);
              setRect((r) => (r && r.w > 0.01 && r.h > 0.01 ? r : null));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="The image to crop" draggable={false} className="block max-h-[28rem] max-w-full" />
            {rect && (
              <>
                {/* Everything outside the choice is dimmed. */}
                <div className="pointer-events-none absolute inset-0 bg-black/40" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.x * 100}% ${rect.y * 100}%, ${rect.x * 100}% ${(rect.y + rect.h) * 100}%, ${(rect.x + rect.w) * 100}% ${(rect.y + rect.h) * 100}%, ${(rect.x + rect.w) * 100}% ${rect.y * 100}%, ${rect.x * 100}% ${rect.y * 100}%)` }} />
                <div className="pointer-events-none absolute border-2 border-dashed border-white mix-blend-difference" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }} />
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={save} disabled={!rect}>
              <Crop aria-hidden /> Crop
            </Button>
            <span className="text-sm" aria-live="polite">
              {pixels ?? "Nothing chosen yet"}
            </span>
          </div>
          {result && <ResultCard blob={result.blob} name={result.name} />}
        </div>
      )}
    </div>
  );
}
