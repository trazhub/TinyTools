"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { API_URL } from "@/lib/site";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { baseName } from "./shared";

const MAX_BYTES = 50 * 1024 * 1024;
const LEVELS = [
  { value: "screen", label: "Smallest" },
  { value: "ebook", label: "Balanced" },
  { value: "printer", label: "Best quality" },
] as const;

export default function PdfCompress() {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<string>("ebook");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  async function run() {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is over 50 MB.");
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("level", level);
      let res: Response;
      try {
        res = await fetch(`${API_URL}/compress`, { method: "POST", body });
      } catch {
        throw new Error("Could not reach the server. Check your connection and try again.");
      }
      if (!res.ok) {
        const detail = await res.json().then((j: { detail?: string }) => j.detail).catch(() => undefined);
        throw new Error(detail ?? "The server could not process that file.");
      }
      setResult({ blob: await res.blob(), name: `${baseName(file.name)}-compressed.pdf` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const saved = file && result ? Math.round((1 - result.blob.size / file.size) * 100) : 0;

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="application/pdf,.pdf"
        hint="A PDF up to 50 MB. It is uploaded to our server."
        onFiles={([f]) => {
          if (!f) return;
          setFile(f);
          setResult(null);
          setError(null);
        }}
      />
      {file && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {file.name}, {formatBytes(file.size)}
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Compression</p>
            <Segmented label="Compression" value={level} onChange={setLevel} options={LEVELS} />
          </div>
          <Button onClick={run} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {busy ? "Compressing…" : "Compress"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {result && (
        <div className="space-y-3 border border-foreground p-4">
          <p className="text-sm">
            {formatBytes(file?.size ?? 0)} → {formatBytes(result.blob.size)}
            {saved > 0 ? ` (${saved}% smaller)` : " (already as small as it gets)"}
          </p>
          <Button onClick={() => downloadBlob(result.blob, result.name)}>
            <Download aria-hidden /> Download
          </Button>
        </div>
      )}
    </div>
  );
}
