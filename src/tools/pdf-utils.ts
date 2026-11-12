import type { PDFDocument } from "pdf-lib";
import { downloadBlob } from "@/lib/utils";

export { parseRanges, type Ranges } from "@/lib/tools/page-ranges";

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
