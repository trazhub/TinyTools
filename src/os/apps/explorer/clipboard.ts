import { createStore } from "../../lib/store";

export interface ExplorerClipboard {
  ids: string[];
  mode: "copy" | "cut";
}

/** Shared by every File Explorer window, so you can copy in one window and paste in another. */
export const explorerClipboard = createStore<ExplorerClipboard | null>(null);
