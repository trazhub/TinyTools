"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { ToolField } from "@/components/tool/tool-field";
import { API_URL } from "@/lib/site";
import { formatBytes } from "@/lib/utils";
import { baseName } from "./shared";
import { ResultCard } from "./result-card";

export type ServerPdfKind = "unlock-pdf" | "protect-pdf" | "repair-pdf" | "ocr-pdf";

const MAX_BYTES = 50 * 1024 * 1024;
const LANGUAGES = [
  { value: "eng", label: "English" },
  { value: "hin", label: "Hindi" },
  { value: "spa", label: "Spanish" },
  { value: "fra", label: "French" },
  { value: "deu", label: "German" },
] as const;

const CONFIG: Record<ServerPdfKind, { path: string; suffix: string; button: string; accept: string; hint: string }> = {
  "unlock-pdf": { path: "unlock", suffix: "unlocked", button: "Unlock", accept: "application/pdf,.pdf", hint: "A password-protected PDF up to 50 MB. It is uploaded to our server." },
  "protect-pdf": { path: "protect", suffix: "protected", button: "Protect", accept: "application/pdf,.pdf", hint: "A PDF up to 50 MB. It is uploaded to our server." },
  "repair-pdf": { path: "repair", suffix: "repaired", button: "Repair", accept: "application/pdf,.pdf", hint: "A damaged PDF up to 50 MB. It is uploaded to our server." },
  "ocr-pdf": { path: "ocr-pdf", suffix: "searchable", button: "Make searchable", accept: "application/pdf,.pdf,image/png,image/jpeg", hint: "A scanned PDF, PNG or JPG up to 50 MB (first 15 pages). It is uploaded to our server." },
};

/** Unlock, protect, repair and make-searchable: send the file to our server, download the result. */
export default function ServerPdf({ kind }: { kind: ServerPdfKind }) {
  const cfg = CONFIG[kind];
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [lang, setLang] = useState("eng");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  async function run() {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is over 50 MB.");
    if (kind === "protect-pdf") {
      if (password.length < 4) return setError("Use a password of at least 4 characters.");
      if (password !== again) return setError("The two passwords do not match.");
    }
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      if (kind === "unlock-pdf" || kind === "protect-pdf") body.append("password", password);
      if (kind === "ocr-pdf") body.append("lang", lang);
      let res: Response;
      try {
        res = await fetch(`${API_URL}/${cfg.path}`, { method: "POST", body });
      } catch {
        throw new Error("Could not reach the server. Check your connection and try again.");
      }
      if (!res.ok) {
        const detail = await res.json().then((j: { detail?: string }) => j.detail).catch(() => undefined);
        throw new Error(detail ?? "The server could not process that file.");
      }
      setResult({ blob: await res.blob(), name: `${baseName(file.name)}-${cfg.suffix}.pdf` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept={cfg.accept}
        hint={cfg.hint}
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
          {kind === "unlock-pdf" && (
            <ToolField label="Password (if it asks for one to open)" htmlFor="pw" hint="Leave empty if the PDF opens without a password but restricts printing or copying.">
              <Input id="pw" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} className="max-w-sm" />
            </ToolField>
          )}
          {kind === "protect-pdf" && (
            <>
              <ToolField label="Password" htmlFor="pw" hint="4 to 64 characters, not starting with @. If you forget it, nobody can recover the file.">
                <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="max-w-sm" />
              </ToolField>
              <ToolField label="Password again" htmlFor="pw2">
                <Input id="pw2" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className="max-w-sm" />
              </ToolField>
            </>
          )}
          {kind === "ocr-pdf" && (
            <ToolField label="Language of the text" htmlFor="lang">
              <Select id="lang" value={lang} onChange={(e) => setLang(e.target.value)} className="max-w-48">
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </ToolField>
          )}
          <Button onClick={run} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {busy ? "Working…" : cfg.button}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {result && <ResultCard blob={result.blob} name={result.name} />}
    </div>
  );
}
