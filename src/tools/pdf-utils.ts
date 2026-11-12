import type { PDFDocument } from "pdf-lib";
import { downloadBlob } from "@/lib/utils";

export type Ranges = { ok: true; groups: number[][] } | { ok: false; error: string };

/**
 * Parse page ranges such as "1-3, 5, 8-" (1-based). Each comma part is one group.
 * "8-" means page 8 to the last page, "-3" means page 1 to 3.
 */
export function parseRanges(spec: string, total: number): Ranges {
  const parts = spec.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "Enter pages, for example 1-3, 5, 8-" };
  const groups: number[][] = [];
  for (const part of parts) {
    const m = /^(\d*)\s*(-)?\s*(\d*)$/.exec(part);
    if (!m || (!m[1] && !m[3])) return { ok: false, error: `"${part}" is not a page or range.` };
    let from: number;
    let to: number;
    if (!m[2]) {
      from = to = Number(m[1]);
    } else {
      from = m[1] ? Number(m[1]) : 1;
      to = m[3] ? Number(m[3]) : total;
    }
    if (from < 1 || to < 1 || from > total || to > total) return { ok: false, error: `"${part}" is outside this PDF (it has ${total} page${total === 1 ? "" : "s"}).` };
    if (from > to) return { ok: false, error: `"${part}" goes backwards.` };
    groups.push(Array.from({ length: to - from + 1 }, (_, i) => from + i));
  }
  return { ok: true, groups };
}

/** Open a PDF for editing with pdf-lib (loaded on demand). */
export async function loadPdfLib(file: File): Promise<PDFDocument> {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    throw new Error("That file is not a PDF this browser can open.");
  }
  if (doc.isEncrypted) throw new Error("This PDF is password protected. Remove the password first.");
  return doc;
}

export async function pdfBlob(doc: PDFDocument): Promise<Blob> {
  return new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
}

export async function savePdf(doc: PDFDocument, filename: string): Promise<void> {
  downloadBlob(await pdfBlob(doc), filename);
}

/** A new PDF made of the given pages (1-based, in the given order) copied from `source`. */
export async function pickPages(source: PDFDocument, pages: number[]): Promise<PDFDocument> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, pages.map((p) => p - 1));
  copied.forEach((p) => out.addPage(p));
  return out;
}
