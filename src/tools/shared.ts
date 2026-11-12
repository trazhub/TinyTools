import { SITE } from "@/lib/site";

/** URL of a file copied into public/vendor by scripts/copy-vendor.mjs. */
export const vendorUrl = (path: string) => `${SITE.base}/vendor/${path}`;

export type Pixels = { width: number; height: number };

export const MAX_SIDE = 16384;
export const MAX_PIXELS = 120_000_000;

/** Returns an error message if the size is not usable, else null. */
export function checkSize({ width, height }: Pixels): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return "Enter a size of at least 1 pixel.";
  if (width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) return "That size is too large for a browser to handle.";
  return null;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))), type, quality),
  );
}

export const baseName = (name: string) => name.replace(/\.[^.]+$/, "") || "file";

export const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Quality for JPEG and WebP output. High, so re-saving an image costs almost nothing visible. */
export const OUTPUT_QUALITY = 0.98;

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.imageSmoothingQuality = "high";
  return [canvas, ctx];
}

/**
 * Draw an image at a new size. Big reductions are done in halving steps, which keeps
 * detail much better than one jump (a single large jump skips pixels and looks jagged).
 * JPEG has no transparency, so it gets a white background.
 */
export function drawScaled(bitmap: ImageBitmap, { width, height }: Pixels, type: string): HTMLCanvasElement {
  let source: CanvasImageSource = bitmap;
  let sw = bitmap.width;
  let sh = bitmap.height;
  while (sw / 2 >= width && sh / 2 >= height) {
    const w = Math.ceil(sw / 2);
    const h = Math.ceil(sh / 2);
    const [step, ctx] = makeCanvas(w, h);
    ctx.drawImage(source, 0, 0, w, h);
    source = step;
    sw = w;
    sh = h;
  }
  const [canvas, ctx] = makeCanvas(width, height);
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export async function openBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("That file is not an image this browser can open (try PNG, JPG or WebP).");
  }
}

/** Turn an error into text for the user. A failed script download gets a plain "reload" hint. */
export function errorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  if (/chunk|dynamically imported module|Importing a module script failed|Failed to fetch/i.test(text)) {
    return "Part of this page failed to load. Reload the page (Ctrl+Shift+R) and try again.";
  }
  return text || "Something went wrong.";
}
