"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { formatBytes } from "@/lib/utils";
import { ResultList, type ResultFile } from "./result-card";
import { EXT, OUTPUT_QUALITY, baseName, canvasToBlob, drawScaled, openBitmap } from "./shared";

const MAX_FILES = 30;

/** Does this JPEG carry an EXIF block (camera, date, often GPS location)? */
async function hasExif(file: File): Promise<boolean> {
  if (file.type !== "image/jpeg") return false;
  const bytes = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  let i = 2;
  while (i + 4 < bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1]!;
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (marker === 0xe1 && String.fromCharCode(...bytes.slice(i + 4, i + 8)) === "Exif") return true;
    if (marker === 0xda) break; // start of image data
    i += 2 + len;
  }
  return false;
}

/** Drawing the picture onto a fresh canvas and saving it again leaves the camera, date and location data behind. */
export default function ImageMetadata() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ResultFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  async function run() {
    setBusy(true);
    setDone([]);
    setErrors([]);
    const out: ResultFile[] = [];
    const bad: string[] = [];
    for (const file of files) {
      try {
        const had = await hasExif(file);
        const bitmap = await openBitmap(file);
        const type = file.type in EXT ? file.type : "image/png";
        const blob = await canvasToBlob(drawScaled(bitmap, bitmap, type), type, OUTPUT_QUALITY);
        out.push({ blob, name: `${baseName(file.name)}-clean.${EXT[type]}`, info: `${had ? "EXIF data removed" : "no EXIF data found"}, was ${formatBytes(file.size)}` });
      } catch (e) {
        bad.push(`${file.name}: ${e instanceof Error ? e.message : "could not be processed."}`);
      }
    }
    setDone(out);
    setErrors(bad);
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/*"
        multiple
        hint={`PNG, JPG or WebP, up to ${MAX_FILES} at a time. Nothing is uploaded.`}
        onFiles={(list) => {
          setFiles(list.slice(0, MAX_FILES));
          setDone([]);
          setErrors([]);
        }}
      />
      {files.length > 0 && (
        <Button onClick={run} disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy ? "Working…" : `Remove metadata from ${files.length} image${files.length === 1 ? "" : "s"}`}
        </Button>
      )}
      <Alert tone="info">The pictures are saved again as new files. That drops camera, date and location data. JPG and WebP are saved at 98% quality.</Alert>
      {errors.map((e) => (
        <Alert key={e} tone="error">
          {e}
        </Alert>
      ))}
      {done.length > 0 && <ResultList files={done} zipName="clean-images.zip" />}
    </div>
  );
}
