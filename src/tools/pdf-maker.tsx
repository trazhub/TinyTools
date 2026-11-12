"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Download, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { canvasToBlob, drawScaled, errorMessage, openBitmap } from "./shared";

const PAGE_SIZES = [
  { value: "fit", label: "Same as image" },
  { value: "a4", label: "A4" },
  { value: "letter", label: "Letter" },
] as const;
const SIZE_PT = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const MARGIN = 24;

let counter = 0;

export default function PdfMaker() {
  const [items, setItems] = useState<{ id: number; file: File }[]>([]);
  const [size, setSize] = useState<string>("fit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function move(i: number, d: -1 | 1) {
    setItems((list) => {
      const next = [...list];
      const a = next[i];
      const b = next[i + d];
      if (a && b) [next[i], next[i + d]] = [b, a];
      return next;
    });
  }

  async function make() {
    setError(null);
    setBusy(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      for (const { file } of items) {
        const bitmap = await openBitmap(file);
        // PNG is embedded as is; everything else goes through a canvas to JPEG (also fixes photo rotation).
        const png = file.type === "image/png";
        const bytes = png
          ? new Uint8Array(await file.arrayBuffer())
          : new Uint8Array(await (await canvasToBlob(drawScaled(bitmap, bitmap, "image/jpeg"), "image/jpeg", 0.92)).arrayBuffer());
        const image = png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        if (size === "fit") {
          pdf.addPage([image.width, image.height]).drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        } else {
          const [pw, ph] = SIZE_PT[size as keyof typeof SIZE_PT];
          const k = Math.min((pw - 2 * MARGIN) / image.width, (ph - 2 * MARGIN) / image.height);
          const w = image.width * k;
          const h = image.height * k;
          pdf.addPage([pw, ph]).drawImage(image, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        }
      }
      downloadBlob(new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" }), "images.pdf");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone
        accept="image/*"
        multiple
        hint="PNG, JPG or WebP. Each image becomes one page. Nothing is uploaded."
        onFiles={(files) => setItems((list) => [...list, ...files.map((file) => ({ id: ++counter, file }))])}
      />

      {items.length > 0 && (
        <div className="space-y-5">
          <ol className="border-t border-foreground">
            {items.map(({ id, file }, i) => (
              <li key={id} className="flex items-center gap-2 border-b border-foreground py-2 text-sm">
                <span className="w-6 text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${file.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${file.name} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} onClick={() => setItems((l) => l.filter((x) => x.id !== id))}>
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ol>
          <div className="space-y-2">
            <p className="text-sm font-medium">Page size</p>
            <Segmented label="Page size" value={size} onChange={setSize} options={PAGE_SIZES} />
          </div>
          <Button onClick={make} disabled={busy}>
            <Download aria-hidden /> {busy ? "Making…" : "Make PDF"}
          </Button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
