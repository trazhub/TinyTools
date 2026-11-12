"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import { API_URL } from "@/lib/site";
import { formatBytes } from "@/lib/utils";

const MAX_BYTES = 50 * 1024 * 1024;
const LANGUAGES = [
  { value: "eng", label: "English" },
  { value: "hin", label: "Hindi" },
  { value: "spa", label: "Spanish" },
  { value: "fra", label: "French" },
  { value: "deu", label: "German" },
] as const;

export default function Ocr() {
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState("eng");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; pages: number } | null>(null);

  async function run() {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is over 50 MB.");
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("lang", lang);
      let res: Response;
      try {
        res = await fetch(`${API_URL}/ocr`, { method: "POST", body });
      } catch {
        throw new Error("Could not reach the server. Check your connection and try again.");
      }
      if (!res.ok) {
        const detail = await res.json().then((j: { detail?: string }) => j.detail).catch(() => undefined);
        throw new Error(detail ?? "The server could not process that file.");
      }
      setResult((await res.json()) as { text: string; pages: number });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/png,image/jpeg,application/pdf,.pdf"
        hint="PNG, JPG or PDF up to 50 MB. It is uploaded to our server."
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
          <ToolField label="Language of the text" htmlFor="lang" hint="PDFs: the first 15 pages are read.">
            <Select id="lang" value={lang} onChange={(e) => setLang(e.target.value)} className="max-w-48">
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </ToolField>
          <Button onClick={run} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {busy ? "Reading…" : "Extract text"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {result && (
        <div className="space-y-3">
          {result.text ? (
            <>
              <Textarea readOnly value={result.text} aria-label="Extracted text" className="min-h-64" />
              <CopyButton text={result.text} label="Copy text" />
            </>
          ) : (
            <Alert tone="info">No text was found. Try a sharper or larger image.</Alert>
          )}
        </div>
      )}
    </div>
  );
}
