import { splitExtension } from "./names";
import type { FsNode } from "./types";

const MIME_BY_EXT: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".json": "application/json",
  ".csv": "text/csv",
  ".log": "text/plain",
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".xml": "application/xml",
  ".yml": "text/yaml",
  ".yaml": "text/yaml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

export function mimeFromName(name: string): string {
  return MIME_BY_EXT[splitExtension(name.toLowerCase())[1]] ?? "application/octet-stream";
}

export function isTextMime(mime: string): boolean {
  return mime.startsWith("text/") || ["application/json", "application/xml", "application/javascript"].includes(mime);
}

export const PREVIEWABLE_IMAGES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

export type FileKind = "folder" | "markdown" | "text" | "code" | "image" | "pdf" | "archive" | "other";

export function fileKind(node: Pick<FsNode, "kind" | "mime" | "name">): FileKind {
  if (node.kind === "dir") return "folder";
  if (node.mime === "text/markdown") return "markdown";
  if (node.mime.startsWith("image/")) return "image";
  if (node.mime === "application/pdf") return "pdf";
  if (node.mime === "application/zip") return "archive";
  if (isTextMime(node.mime)) {
    return ["text/plain", "text/csv"].includes(node.mime) ? "text" : "code";
  }
  return "other";
}

/** Human-readable type for the Explorer's "Type" column. */
export function kindLabel(node: Pick<FsNode, "kind" | "mime" | "name">): string {
  switch (fileKind(node)) {
    case "folder":
      return "Folder";
    case "markdown":
      return "Markdown document";
    case "text":
      return "Text document";
    case "code":
      return "Source / data file";
    case "image":
      return "Image";
    case "pdf":
      return "PDF document";
    case "archive":
      return "Archive";
    default:
      return "File";
  }
}
