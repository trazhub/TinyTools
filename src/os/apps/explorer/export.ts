import { sanitizeFilename } from "@/lib/utils";
import { createZip, type ZipEntry } from "@/lib/zip";
import type { FsNode } from "../../filesystem/types";
import type { VirtualFileSystem } from "../../filesystem/vfs";

export interface ExportFile {
  /** Path inside the archive, using "/" separators. */
  path: string;
  node: FsNode;
}

/** Every file to export, with the folder structure preserved relative to the selected items. */
export function collectFiles(fs: VirtualFileSystem, ids: readonly string[]): ExportFile[] {
  const out: ExportFile[] = [];
  const walk = (node: FsNode, prefix: string) => {
    const safe = sanitizeFilename(node.name, "item");
    if (node.kind === "file") {
      out.push({ path: prefix + safe, node });
    } else {
      for (const child of fs.list(node.id, { hidden: true })) walk(child, `${prefix}${safe}/`);
    }
  };
  for (const id of ids) {
    const node = fs.get(id);
    if (node) walk(node, "");
  }
  return out;
}

export type ExportPlan =
  | { ok: true; blob: Blob; filename: string }
  | { ok: false; error: string };

/**
 * Prepare something to download. One file is downloaded as-is; a folder or several
 * items become a ZIP. (Empty folders cannot be represented in the ZIP and are skipped.)
 */
export async function buildExport(fs: VirtualFileSystem, ids: readonly string[]): Promise<ExportPlan> {
  const nodes = ids.map((id) => fs.get(id)).filter((n): n is FsNode => Boolean(n));
  if (nodes.length === 0) return { ok: false, error: "Nothing selected to export." };

  if (nodes.length === 1 && nodes[0]!.kind === "file") {
    const blob = fs.readBlob(nodes[0]!.id);
    return blob ? { ok: true, blob, filename: sanitizeFilename(nodes[0]!.name, "file") } : { ok: false, error: `“${nodes[0]!.name}” has no contents to export.` };
  }

  const files = collectFiles(fs, ids);
  if (files.length === 0) return { ok: false, error: "There are no files inside to export." };

  const entries: ZipEntry[] = [];
  for (const { path, node } of files) {
    const blob = fs.readBlob(node.id);
    entries.push({ name: path, data: blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array() });
  }
  const base = nodes.length === 1 ? sanitizeFilename(nodes[0]!.name, "folder") : "TinyTools-export";
  return { ok: true, blob: new Blob([createZip(entries) as BlobPart], { type: "application/zip" }), filename: `${base}.zip` };
}
