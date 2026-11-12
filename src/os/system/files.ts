import { fileKind } from "../filesystem/mime";
import type { FsNode } from "../filesystem/types";
import type { AppProps } from "../window-manager/types";

/** Decide which app opens a file or folder, and with what arguments. */
export function appForNode(node: FsNode): { appId: string; props: AppProps } {
  if (node.kind === "dir") return { appId: "explorer", props: { folderId: node.id } };
  switch (fileKind(node)) {
    case "markdown":
    case "text":
    case "code":
      return { appId: "notes", props: { nodeId: node.id } };
    default:
      // Images and other files are previewed in File Explorer, which can also export them.
      return { appId: "explorer", props: { folderId: node.parentId ?? undefined, select: node.id } };
  }
}
