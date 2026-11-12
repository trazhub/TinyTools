import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  buildOutputName,
  computeTargetSize,
  detectImageType,
  resolveOutputType,
  savingsPercent,
  validateImageFile,
} from "./image-compress";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const WEBP = bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), ...ascii("VP8 "));

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP by content", () => {
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(WEBP)).toBe("image/webp");
  });

  it("rejects everything else", () => {
    expect(detectImageType(bytes(...ascii("GIF89a")))).toBeNull();
    expect(detectImageType(bytes(...ascii("<svg xmlns")))).toBeNull();
    expect(detectImageType(bytes(...ascii("%PDF-1.7")))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
    // RIFF container that is a WAV, not a WebP
    expect(detectImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))).toBeNull();
  });
});

describe("validateImageFile", () => {
  it("accepts real images regardless of extension or declared MIME type", async () => {
    const r = await validateImageFile(new File([PNG], "weird.txt", { type: "text/plain" }));
    expect(r).toEqual({ ok: true, type: "image/png" });
  });

  it("rejects fake images (right extension, wrong content)", async () => {
    const r = await validateImageFile(new File(["not an image"], "photo.jpg", { type: "image/jpeg" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not a jpeg, png or webp/i);
  });

  it("rejects empty files", async () => {
    const r = await validateImageFile(new File([], "empty.png", { type: "image/png" }));
    expect(r).toEqual({ ok: false, error: "The file is empty." });
  });

  it("rejects oversized files before reading them", async () => {
    const big = new File([PNG], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: MAX_FILE_BYTES + 1 });
    const r = await validateImageFile(big);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/50 MB/);
  });
});

describe("computeTargetSize", () => {
  it("keeps the size when no limit is set or the image is already small", () => {
    expect(computeTargetSize(4000, 3000, 0)).toEqual({ width: 4000, height: 3000 });
    expect(computeTargetSize(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });

  it("scales the longest side, preserving aspect ratio", () => {
    expect(computeTargetSize(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(computeTargetSize(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it("never produces a zero dimension", () => {
    expect(computeTargetSize(10000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});

describe("naming and math", () => {
  it("builds safe output names with the right extension", () => {
    expect(buildOutputName("holiday photo.JPG", "image/webp")).toBe("holiday photo-compressed.webp");
    expect(buildOutputName("../../etc/passwd", "image/png")).toBe("_.._etc_passwd-compressed.png");
    expect(buildOutputName("noext", "image/jpeg")).toBe("noext-compressed.jpg");
    expect(buildOutputName("", "image/jpeg")).toBe("image-compressed.jpg");
  });

  it("resolves the output type", () => {
    expect(resolveOutputType("image/png", "original")).toBe("image/png");
    expect(resolveOutputType("image/png", "image/webp")).toBe("image/webp");
  });

  it("computes savings, including negative savings when output grows", () => {
    expect(savingsPercent(1000, 250)).toBe(75);
    expect(savingsPercent(1000, 1200)).toBe(-20);
    expect(savingsPercent(0, 10)).toBe(0);
  });
});
