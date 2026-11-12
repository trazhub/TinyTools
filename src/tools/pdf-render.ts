import { vendorUrl } from "./shared";

/** Open a PDF with pdf.js (loaded on demand; its worker is served from public/vendor). */
export async function openPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = vendorUrl("pdf.worker.min.mjs");
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    const name = (e as Error).name;
    if (name === "PasswordException") throw new Error("This PDF is password protected. Remove the password first.");
    throw new Error("That file is not a PDF this browser can open.");
  }
}

type Doc = Awaited<ReturnType<typeof openPdf>>;

/** Render one page (1-based) to a canvas. `scale` 1 = 72 dpi. */
export async function renderPage(doc: Doc, pageNumber: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return canvas;
}

/** Largest scale at which a page stays within a safe canvas size. */
export function safeScale(widthPt: number, heightPt: number, wanted: number): number {
  const maxPixels = 40_000_000;
  const maxScale = Math.sqrt(maxPixels / (widthPt * heightPt));
  return Math.min(wanted, maxScale);
}
