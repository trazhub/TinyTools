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

/** Draw an image at a new size. JPEG has no transparency, so it gets a white background. */
export function drawScaled(bitmap: ImageBitmap, { width, height }: Pixels, type: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

export async function openBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("That file is not an image this browser can open (try PNG, JPG or WebP).");
  }
}
