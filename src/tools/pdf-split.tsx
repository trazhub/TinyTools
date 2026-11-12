"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { ToolField } from "@/components/tool/tool-field";
import { ResultList, type ResultFile } from "./result-card";
import { baseName, errorMessage } from "./shared";
import { loadPdfLib, parseRanges, pickPages } from "./pdf-utils";

const MODES = [
  { value: "each", label: "Every page" },
  { value: "ranges", label: "Custom ranges" },
] as const;

export default function PdfSplit() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [mode, setMode] = useState<string>("each");
  const [spec, setSpec] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parts, setParts] = useState<ResultFile[] | null>(null);

  async function pick([f]: File[]) {
    if (!f) return;
    setFile(f);
    setPages(null);
    setError(null);
    setParts(null);
    try {
      setPages((await loadPdfLib(f)).getPageCount());
    } catch (e) {
      setFile(null);
      setError(errorMessage(e));
    }
  }

  async function run() {
    if (!file) return;
    setError(null);
    setParts(null);
    setBusy(true);
    try {
      const doc = await loadPdfLib(file);
      const total = doc.getPageCount();
      let groups: number[][];
      if (mode === "each") {
        groups = Array.from({ length: total }, (_, i) => [i + 1]);
      } else {
        const r = parseRanges(spec, total);
        if (!r.ok) throw new Error(r.error);
        groups = r.groups;
      }
      const name = baseName(file.name);
      const pad = String(groups.length).length;
      const made: ResultFile[] = [];
      for (const [i, g] of groups.entries()) {
        const part = await pickPages(doc, g);
        made.push({
          name: `${name}-${String(i + 1).padStart(pad, "0")}.pdf`,
          blob: new Blob([(await part.save()) as BlobPart], { type: "application/pdf" }),
          info: `${g.length} page${g.length === 1 ? "" : "s"}`,
        });
      }
      setParts(made);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone accept="application/pdf,.pdf" hint="A PDF. Nothing is uploaded." onFiles={pick} />
      {file && pages !== null && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {file.name}, {pages} page{pages === 1 ? "" : "s"}
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Split</p>
            <Segmented label="Split" value={mode} onChange={setMode} options={MODES} />
          </div>
          {mode === "ranges" && (
            <ToolField label="Ranges" htmlFor="ranges" hint="Each range becomes its own PDF. Example: 1-3, 4-6, 7-">
              <Input id="ranges" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="1-3, 4-6, 7-" className="max-w-sm" />
            </ToolField>
          )}
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {busy ? "Splitting…" : "Split PDF"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {parts && <ResultList files={parts} zipName={`${baseName(file?.name ?? "split")}-split.zip`} />}
    </div>
  );
}
