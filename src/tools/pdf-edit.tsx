"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Segmented, Select } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { ToolField } from "@/components/tool/tool-field";
import { baseName, errorMessage } from "./shared";
import { ResultCard } from "./result-card";
import { loadPdfLib, parseRanges, pickPages, pdfBlob } from "./pdf-utils";

export type PdfEditKind = "remove-pages" | "extract-pages" | "rotate-pdf" | "page-numbers" | "watermark-pdf" | "crop-pdf";

const POSITIONS = [
  { value: "bottom-center", label: "Bottom centre" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top centre" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
] as const;
const ANGLES = [
  { value: "90", label: "90° right" },
  { value: "180", label: "180°" },
  { value: "270", label: "90° left" },
] as const;
const FORMATS = [
  { value: "n", label: "1" },
  { value: "page", label: "Page 1" },
  { value: "of", label: "1 of 10" },
] as const;

const MM = 72 / 25.4;
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** One component behind six pages: each kind shows its own options and edits the PDF in the browser. */
export default function PdfEdit({ kind }: { kind: PdfEditKind }) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  // options (strings so the fields can be empty while typing)
  const [spec, setSpec] = useState("");
  const [angle, setAngle] = useState("90");
  const [position, setPosition] = useState("bottom-center");
  const [start, setStart] = useState("1");
  const [format, setFormat] = useState("n");
  const [text, setText] = useState("CONFIDENTIAL");
  const [size, setSize] = useState("60");
  const [opacity, setOpacity] = useState("25");
  const [margins, setMargins] = useState({ top: "10", bottom: "10", left: "10", right: "10" });

  async function pick([f]: File[]) {
    setResult(null);
    if (!f) return;
    setFile(f);
    setPages(null);
    setError(null);
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
    setResult(null);
    setBusy(true);
    try {
      const { StandardFonts, degrees, rgb } = await import("pdf-lib");
      let doc = await loadPdfLib(file);
      const total = doc.getPageCount();
      const name = baseName(file.name);

      if (kind === "remove-pages" || kind === "extract-pages") {
        const r = parseRanges(spec, total);
        if (!r.ok) throw new Error(r.error);
        const chosen = [...new Set(r.groups.flat())];
        const keep = kind === "extract-pages" ? r.groups.flat() : Array.from({ length: total }, (_, i) => i + 1).filter((p) => !chosen.includes(p));
        if (keep.length === 0) throw new Error("That would remove every page.");
        doc = await pickPages(doc, keep);
      } else if (kind === "rotate-pdf") {
        let targets = Array.from({ length: total }, (_, i) => i + 1);
        if (spec.trim()) {
          const r = parseRanges(spec, total);
          if (!r.ok) throw new Error(r.error);
          targets = r.groups.flat();
        }
        for (const p of targets) {
          const page = doc.getPage(p - 1);
          page.setRotation(degrees((page.getRotation().angle + Number(angle)) % 360));
        }
      } else if (kind === "page-numbers") {
        const first = Math.round(num(start));
        if (!Number.isFinite(first)) throw new Error("Enter the number to start from.");
        const font = await doc.embedFont(StandardFonts.Helvetica);
        doc.getPages().forEach((page, i) => {
          const n = first + i;
          const label = format === "page" ? `Page ${n}` : format === "of" ? `${n} of ${first + total - 1}` : String(n);
          const fs = 11;
          const w = font.widthOfTextAtSize(label, fs);
          const { width, height } = page.getSize();
          const [v, h] = position.split("-");
          const x = h === "left" ? 28 : h === "right" ? width - 28 - w : (width - w) / 2;
          const y = v === "top" ? height - 28 : 20;
          page.drawText(label, { x, y, size: fs, font, color: rgb(0, 0, 0) });
        });
      } else if (kind === "watermark-pdf") {
        const fs = num(size);
        const op = num(opacity) / 100;
        if (!text.trim()) throw new Error("Enter the watermark text.");
        if (!(fs >= 8 && fs <= 300)) throw new Error("Text size must be between 8 and 300.");
        if (!(op > 0 && op <= 1)) throw new Error("Opacity must be between 1 and 100.");
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        let w: number;
        try {
          w = font.widthOfTextAtSize(text, fs);
        } catch {
          throw new Error("Use letters, numbers and common symbols only.");
        }
        const rad = Math.PI / 4;
        const h = fs * 0.7;
        for (const page of doc.getPages()) {
          const { width, height } = page.getSize();
          // Centre the rotated text on the page.
          const x = width / 2 - (w / 2) * Math.cos(rad) + (h / 2) * Math.sin(rad);
          const y = height / 2 - (w / 2) * Math.sin(rad) - (h / 2) * Math.cos(rad);
          page.drawText(text, { x, y, size: fs, font, color: rgb(0.5, 0.5, 0.5), opacity: op, rotate: degrees(45) });
        }
      } else if (kind === "crop-pdf") {
        const m = { top: num(margins.top), bottom: num(margins.bottom), left: num(margins.left), right: num(margins.right) };
        if (Object.values(m).some((v) => !(v >= 0))) throw new Error("Margins must be 0 or more.");
        for (const page of doc.getPages()) {
          const box = page.getMediaBox();
          const w = box.width - (m.left + m.right) * MM;
          const h = box.height - (m.top + m.bottom) * MM;
          if (w < 10 || h < 10) throw new Error("Those margins leave no page. Use smaller values.");
          page.setCropBox(box.x + m.left * MM, box.y + m.bottom * MM, w, h);
        }
      }

      setResult({ blob: await pdfBlob(doc), name: `${name}-${kind.replace("-pdf", "").replace("-pages", "")}.pdf` });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const rangeHint = pages ? `This PDF has ${pages} page${pages === 1 ? "" : "s"}. Example: 1-3, 5, 8-` : "";

  return (
    <div className="space-y-6">
      <FileDropzone accept="application/pdf,.pdf" hint="A PDF. Nothing is uploaded." onFiles={pick} />
      {file && pages !== null && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {file.name}, {pages} page{pages === 1 ? "" : "s"}
          </p>

          {(kind === "remove-pages" || kind === "extract-pages") && (
            <ToolField label={kind === "remove-pages" ? "Pages to remove" : "Pages to keep"} htmlFor="spec" hint={rangeHint}>
              <Input id="spec" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="1-3, 5, 8-" className="max-w-sm" />
            </ToolField>
          )}

          {kind === "rotate-pdf" && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Rotate by</p>
                <Segmented label="Rotate by" value={angle} onChange={setAngle} options={ANGLES} />
              </div>
              <ToolField label="Pages (leave empty for all)" htmlFor="spec" hint={rangeHint}>
                <Input id="spec" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="all pages" className="max-w-sm" />
              </ToolField>
            </>
          )}

          {kind === "page-numbers" && (
            <div className="flex flex-wrap gap-4">
              <ToolField label="Position" htmlFor="pos">
                <Select id="pos" value={position} onChange={(e) => setPosition(e.target.value)} className="w-44">
                  {POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </ToolField>
              <ToolField label="Style" htmlFor="fmt">
                <Select id="fmt" value={format} onChange={(e) => setFormat(e.target.value)} className="w-36">
                  {FORMATS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </ToolField>
              <ToolField label="Start at" htmlFor="start">
                <Input id="start" type="number" value={start} onChange={(e) => setStart(e.target.value)} className="w-24" />
              </ToolField>
            </div>
          )}

          {kind === "watermark-pdf" && (
            <div className="flex flex-wrap gap-4">
              <ToolField label="Text" htmlFor="wm">
                <Input id="wm" value={text} onChange={(e) => setText(e.target.value)} className="w-64" />
              </ToolField>
              <ToolField label="Size" htmlFor="wmsize">
                <Input id="wmsize" type="number" value={size} onChange={(e) => setSize(e.target.value)} className="w-24" />
              </ToolField>
              <ToolField label="Opacity (%)" htmlFor="wmop">
                <Input id="wmop" type="number" value={opacity} onChange={(e) => setOpacity(e.target.value)} className="w-24" />
              </ToolField>
            </div>
          )}

          {kind === "crop-pdf" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Cut from each edge (mm)</p>
              <div className="flex flex-wrap gap-4">
                {(["top", "bottom", "left", "right"] as const).map((side) => (
                  <ToolField key={side} label={side[0]!.toUpperCase() + side.slice(1)} htmlFor={`m-${side}`}>
                    <Input
                      id={`m-${side}`}
                      type="number"
                      min={0}
                      value={margins[side]}
                      onChange={(e) => setMargins((m) => ({ ...m, [side]: e.target.value }))}
                      className="w-24"
                    />
                  </ToolField>
                ))}
              </div>
            </div>
          )}

          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {busy ? "Working…" : "Make PDF"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {result && <ResultCard blob={result.blob} name={result.name} />}
    </div>
  );
}
