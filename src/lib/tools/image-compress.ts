import { sanitizeFilename } from "@/lib/utils";

export type ImageType = "image/jpeg" | "image/png" | "image/webp";
export type OutputFormat = "original" | ImageType;

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Safari on iOS cannot allocate canvases beyond ~16.7 MP, most desktops allow far more. */
export const MAX_PIXELS = 100_000_000;
export const MAX_FILES = 30;

const EXTENSION: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const IMAGE_TYPE_LABEL: Record<ImageType, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

/** Identify an image by its magic bytes (never trust the extension or MIME type alone). */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type FileCheck = { ok: true; type: ImageType } | { ok: false; error: string };

export async function validateImageFile(file: File): Promise<FileCheck> {
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `The file is larger than the ${MAX_FILE_BYTES / 1024 / 1024} MB limit.` };
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const type = detectImageType(header);
  if (!type) {
    return { ok: false, error: "Not a JPEG, PNG or WebP image. Other formats (GIF, HEIC, SVG, AVIF) are not supported." };
  }
  return { ok: true, type };
}

export interface CompressOptions {
  /** 0.1 - 1. Used for JPEG and WebP output; PNG is always lossless. */
  quality: number;
  format: OutputFormat;
  /** Longest side in pixels. 0 means "keep the original size". */
  maxDimension: number;
}

export function resolveOutputType(input: ImageType, format: OutputFormat): ImageType {
  return format === "original" ? input : format;
}

/** Scale (width, height) down so the longest side is at most `maxDimension`. Never upscales. */
export function computeTargetSize(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (maxDimension <= 0 || Math.max(width, height) <= maxDimension) return { width, height };
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function buildOutputName(originalName: string, type: ImageType): string {
  const safe = sanitizeFilename(originalName, "image");
  const base = safe.replace(/\.[A-Za-z0-9]{1,5}$/, "") || safe;
  return `${base}-compressed.${EXTENSION[type]}`;
}

export function savingsPercent(originalBytes: number, outputBytes: number): number {
  if (originalBytes <= 0) return 0;
  return Math.round((1 - outputBytes / originalBytes) * 100);
}

export interface CompressResult {
  blob: Blob;
  type: ImageType;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: ImageType, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Re-encode an image in the browser using canvas. Nothing leaves the device.
 * Note: re-encoding drops metadata such as EXIF/GPS, and applies EXIF rotation.
 */
export async function compressImage(file: File, inputType: ImageType, options: CompressOptions): Promise<CompressResult> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be decoded. The file may be corrupted.");
  }

  try {
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    if (originalWidth * originalHeight > MAX_PIXELS) {
      throw new Error(`The image is too large to process (over ${MAX_PIXELS / 1_000_000} megapixels).`);
    }

    const { width, height } = computeTargetSize(originalWidth, originalHeight, options.maxDimension);
    const outputType = resolveOutputType(inputType, options.format);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not create a drawing surface for this image.");

    if (outputType === "image/jpeg") {
      // JPEG has no transparency; transparent pixels would otherwise turn black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, outputType, options.quality);
    if (!blob || blob.type !== outputType) {
      throw new Error(
        `Your browser cannot encode ${IMAGE_TYPE_LABEL[outputType]} images${blob ? "" : " at this size"}. Try a different output format.`,
      );
    }
    canvas.width = canvas.height = 0; // release memory early
    return { blob, type: outputType, width, height, originalWidth, originalHeight };
  } finally {
    bitmap.close();
  }
}
