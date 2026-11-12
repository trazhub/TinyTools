"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { EXT, OUTPUT_QUALITY, baseName, errorMessage, canvasToBlob, drawScaled, openBitmap } from "./shared";

const FORMATS = [
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPG" },
  { value: "image/webp", label: "WebP" },
] as const;

interface Result {
  blob: Blob;
  url: string;
  name: string;
}

export default function ImageConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<string>("image/png");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  async function convert() {
    if (!file) return;
    setError(null);
    try {
      const bitmap = await openBitmap(file);
      const blob = await canvasToBlob(drawScaled(bitmap, bitmap, type), type, OUTPUT_QUALITY);
      setResult({ blob, url: URL.createObjectURL(blob), name: `${baseName(file.name)}.${EXT[type]}` });
    } catch (e) {
      setResult(null);
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/*"
        hint="PNG, JPG or WebP. Nothing is uploaded."
        onFiles={([f]) => {
          if (!f) return;
          setFile(f);
          setResult(null);
          setError(null);
        }}
      />
      {file && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {file.name}, {formatBytes(file.size)}
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Convert to</p>
            <Segmented
              label="Format"
              value={type}
              onChange={(v) => {
                setType(v);
                setResult(null);
              }}
              options={FORMATS}
            />
          </div>
          <Button onClick={convert}>Convert</Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {result && (
        <div className="space-y-3 border border-foreground p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.url} alt="Result" className="max-h-64 max-w-full border border-border" />
          <p className="text-sm">
            {result.name}, {formatBytes(result.blob.size)}
          </p>
          <Button onClick={() => downloadBlob(result.blob, result.name)}>
            <Download aria-hidden /> Download
          </Button>
        </div>
      )}
    </div>
  );
}
