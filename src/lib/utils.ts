import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const UNITS = ["B", "KB", "MB", "GB"] as const;

/** Human-readable file size, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits).replace(/\.?0+$/, "")} ${UNITS[unit]}`;
}

/**
 * Make a user-supplied filename safe to use as a download name:
 * strips path separators, control and reserved characters, leading dots and
 * trailing dots/spaces, and caps the length while keeping the extension.
 */
export function sanitizeFilename(name: string, fallback = "file"): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_")
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .trim();
  if (!cleaned) return fallback;

  const dot = cleaned.lastIndexOf(".");
  const hasExt = dot > 0 && cleaned.length - dot <= 10;
  const ext = hasExt ? cleaned.slice(dot) : "";
  const base = hasExt ? cleaned.slice(0, dot) : cleaned;
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base);
  const safeBase = (reserved ? `_${base}` : base).slice(0, 100);
  return `${safeBase}${ext}`;
}

/** Trigger a browser download for an in-memory blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeFilename(filename, "download");
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copy text to the clipboard. Returns false if the browser refuses. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts or denied permission.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
