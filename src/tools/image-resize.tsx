"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { ToolField } from "@/components/tool/tool-field";
import { formatBytes } from "@/lib/utils";
import { EXT, OUTPUT_QUALITY, baseName, errorMessage, canvasToBlob, checkSize, drawScaled, openBitmap } from "./shared";
import { ResultCard } from "./result-card";

interface Loaded {
  file: File;
  bitmap: ImageBitmap;
}
interface Result {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  name: string;
}

/**
 * One component, two pages: "scale" resizes by a percentage, "resolution" sets exact pixels.
 * Output keeps the input format (PNG, JPEG or WebP; anything else becomes PNG).
 */
export default function ImageResize({ mode }: { mode: "scale" | "resolution" }) {
  const [img, setImg] = useState<Loaded | null>(null);
  const [percent, setPercent] = useState("50");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  async function pick([file]: File[]) {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const bitmap = await openBitmap(file);
      setImg({ file, bitmap });
      setWidth(String(bitmap.width));
      setHeight(String(bitmap.height));
    } catch (e) {
      setImg(null);
      setError(errorMessage(e));
    }
  }

  // Changing one side keeps the aspect ratio by updating the other.
  function onWidth(v: string) {
    setWidth(v);
    if (img && Number(v) > 0) setHeight(String(Math.max(1, Math.round((Number(v) * img.bitmap.height) / img.bitmap.width))));
  }
  function onHeight(v: string) {
    setHeight(v);
    if (img && Number(v) > 0) setWidth(String(Math.max(1, Math.round((Number(v) * img.bitmap.width) / img.bitmap.height))));
  }

  async function run() {
    if (!img) return;
    const size =
      mode === "scale"
        ? {
            width: Math.round((img.bitmap.width * Number(percent)) / 100),
            height: Math.round((img.bitmap.height * Number(percent)) / 100),
          }
        : { width: Math.round(Number(width)), height: Math.round(Number(height)) };
    const bad = checkSize(size);
    if (bad) return setError(bad);
    setError(null);
    try {
      const type = img.file.type in EXT ? img.file.type : "image/png";
      const blob = await canvasToBlob(drawScaled(img.bitmap, size, type), type, OUTPUT_QUALITY);
      setResult({
        blob,
        url: URL.createObjectURL(blob),
        ...size,
        name: `${baseName(img.file.name)}-${size.width}x${size.height}.${EXT[type]}`,
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone accept="image/*" hint="PNG, JPG or WebP. Nothing is uploaded." onFiles={pick} />
      {error && <Alert tone="error">{error}</Alert>}

      {img && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {img.file.name}: {img.bitmap.width} × {img.bitmap.height} px, {formatBytes(img.file.size)}
          </p>

          {mode === "scale" ? (
            <ToolField label="Scale (%)" htmlFor="pct" hint="100 keeps the size. 50 makes it half as wide and half as tall.">
              <Input id="pct" type="number" min={1} max={1000} value={percent} onChange={(e) => setPercent(e.target.value)} className="max-w-40" />
            </ToolField>
          ) : (
            <div className="flex flex-wrap gap-4">
              <ToolField label="Width (px)" htmlFor="w">
                <Input id="w" type="number" min={1} value={width} onChange={(e) => onWidth(e.target.value)} className="w-36" />
              </ToolField>
              <ToolField label="Height (px)" htmlFor="h">
                <Input id="h" type="number" min={1} value={height} onChange={(e) => onHeight(e.target.value)} className="w-36" />
              </ToolField>
            </div>
          )}

          <Button onClick={run}>{mode === "scale" ? "Scale" : "Change resolution"}</Button>
        </div>
      )}

      {result && <ResultCard blob={result.blob} name={result.name} note={`${result.width} × ${result.height} px`} />}
    </div>
  );
}
