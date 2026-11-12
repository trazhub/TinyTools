import { File, FileArchive, FileCode2, FileImage, FileText, Folder, FolderOpen, NotebookText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileKind, type FileKind } from "./mime";
import type { FsNode } from "./types";

const ICONS: Record<FileKind, { icon: LucideIcon; tone: string }> = {
  folder: { icon: Folder, tone: "text-[oklch(0.78_0.13_85)]" },
  markdown: { icon: NotebookText, tone: "text-[oklch(0.75_0.12_250)]" },
  text: { icon: FileText, tone: "text-[oklch(0.75_0.03_265)]" },
  code: { icon: FileCode2, tone: "text-[oklch(0.78_0.13_160)]" },
  image: { icon: FileImage, tone: "text-[oklch(0.75_0.15_330)]" },
  pdf: { icon: FileText, tone: "text-[oklch(0.72_0.17_25)]" },
  archive: { icon: FileArchive, tone: "text-[oklch(0.78_0.12_60)]" },
  other: { icon: File, tone: "text-[oklch(0.72_0.02_265)]" },
};

/** Icon for a file or folder, tinted by type. */
export function FileIcon({ node, size = 20, open = false, className }: { node: Pick<FsNode, "kind" | "mime" | "name">; size?: number; open?: boolean; className?: string }) {
  const kind = fileKind(node);
  const { icon, tone } = ICONS[kind];
  const Icon = kind === "folder" && open ? FolderOpen : icon;
  return <Icon aria-hidden width={size} height={size} strokeWidth={1.75} className={cn("shrink-0", tone, kind === "folder" && "fill-current/20", className)} />;
}
