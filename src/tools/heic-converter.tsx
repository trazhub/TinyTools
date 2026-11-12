"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { formatBytes } from "@/lib/utils";
import { ResultList, type ResultFile } from "./result-card";
import { baseName, errorMessage } from "./shared";

const FORMATS = [
  { value: "image/jpeg", label: "JPG" },
  { value: "image/png", label: "PNG" },
] as const;
const MAX_FILES = 30;
const MAX_BYTES = 60 * 1024 * 1024;

/** iPhone photos (HEIC/HEIF) to JPG or PNG, decoded in the browser. */
export default function HeicConverter() {
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState<string>("image/jpeg");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<ResultFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  async function convert() {
    setDone([]);
    setErrors([]);
    const ext = type === "image/png" ? "png" : "jpg";
    const out: ResultFile[] = [];
    const bad: string[] = [];
    try {
      const heic2any = (await import("heic2any")).default;
      for (const [i, file] of files.entries()) {
        setBusy(`Converting ${i + 1} of ${files.length}…`);
        if (file.size > MAX_BYTES) {
          bad.push(`${file.name}: over 60 MB.`);
          continue;
        }
        try {
          const result = await heic2any({ blob: file, toType: type, quality: 0.95 });
          const blobs = Array.isArray(result) ? result : [result];
          blobs.forEach((blob, n) => out.push({ blob, name: `${baseName(file.name)}${blobs.length > 1 ? `-${n + 1}` : ""}.${ext}` }));
        } catch {
          bad.push(`${file.name}: not a HEIC photo this tool can read.`);
        }
      }
    } catch (e) {
      bad.push(errorMessage(e));
    } finally {
      setBusy(null);
    }
    setDone(out);
    setErrors(bad);
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept=".heic,.heif,image/heic,image/heif"
        multiple
        hint={`HEIC or HEIF photos, up to ${MAX_FILES} at a time. Nothing is uploaded.`}
        onFiles={(list) => {
          setFiles(list.slice(0, MAX_FILES));
          setDone([]);
          setErrors([]);
        }}
      />
      {files.length > 0 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {files.length} file{files.length === 1 ? "" : "s"}, {formatBytes(files.reduce((n, f) => n + f.size, 0))}
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Convert to</p>
            <Segmented label="Format" value={type} onChange={setType} options={FORMATS} />
          </div>
          <Button onClick={convert} disabled={busy !== null}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {busy ?? "Convert"}
          </Button>
        </div>
      )}
      {errors.map((e) => (
        <Alert key={e} tone="error">
          {e}
        </Alert>
      ))}
      {done.length > 0 && <ResultList files={done} zipName="photos.zip" />}
    </div>
  );
}
