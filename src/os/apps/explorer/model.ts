import { kindLabel } from "../../filesystem/mime";
import { compareNames } from "../../filesystem/names";
import { HOME_ID, ROOT_ID, TRASH_ID, type FsNode } from "../../filesystem/types";
import type { VirtualFileSystem } from "../../filesystem/vfs";

export type SortKey = "name" | "modified" | "size" | "type";
export interface SortSpec {
  key: SortKey;
  dir: "asc" | "desc";
}

export const SORT_LABELS: Record<SortKey, string> = { name: "Name", modified: "Date modified", size: "Size", type: "Type" };

/** Sort items. Folders always stay above files, whatever the column. */
export function sortNodes<T extends FsNode>(nodes: readonly T[], sort: SortSpec): T[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  const compare = (a: FsNode, b: FsNode): number => {
    switch (sort.key) {
      case "modified":
        return a.modifiedAt - b.modifiedAt || compareNames(a.name, b.name);
      case "size":
        return a.size - b.size || compareNames(a.name, b.name);
      case "type":
        return compareNames(kindLabel(a), kindLabel(b)) || compareNames(a.name, b.name);
      default:
        return compareNames(a.name, b.name);
    }
  };
  return [...nodes].sort((a, b) => (a.kind === b.kind ? sign * compare(a, b) : a.kind === "dir" ? -1 : 1));
}

/** The ids between `anchor` and `target` (inclusive) in display order. */
export function selectRange(ordered: readonly string[], anchor: string | null, target: string): string[] {
  const to = ordered.indexOf(target);
  if (to === -1) return [];
  const from = anchor === null ? to : ordered.indexOf(anchor);
  if (from === -1) return [target];
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return ordered.slice(lo, hi + 1);
}

export interface Crumb {
  id: string;
  label: string;
}

/** Path segments for the address bar. Inside Home the trail starts at "Home". */
export function breadcrumbs(fs: VirtualFileSystem, id: string): Crumb[] {
  if (id === TRASH_ID) return [{ id: TRASH_ID, label: "Trash" }];
  const trail: Crumb[] = [];
  for (let cur = fs.get(id); cur; cur = fs.parent(cur.id)) {
    if (cur.id === HOME_ID) {
      trail.unshift({ id: cur.id, label: "Home" });
      return trail;
    }
    trail.unshift({ id: cur.id, label: cur.id === ROOT_ID ? "Computer" : cur.name });
    if (trail.length > 64) break;
  }
  return trail;
}

/** True when a folder exists and is somewhere the user can browse (not inside the trash, except the trash itself). */
export function isBrowsable(fs: VirtualFileSystem, id: string): boolean {
  const node = fs.get(id);
  if (!node || node.kind !== "dir") return false;
  return id === TRASH_ID || !fs.isInTrash(id) || fs.isDescendant(id, TRASH_ID);
}

export interface NavState {
  stack: string[];
  index: number;
}

const MAX_HISTORY = 50;

export function navigate(nav: NavState, id: string): NavState {
  if (nav.stack[nav.index] === id) return nav;
  const stack = [...nav.stack.slice(0, nav.index + 1), id].slice(-MAX_HISTORY);
  return { stack, index: stack.length - 1 };
}

export const canGoBack = (nav: NavState) => nav.index > 0;
export const canGoForward = (nav: NavState) => nav.index < nav.stack.length - 1;
export const goBack = (nav: NavState): NavState => (canGoBack(nav) ? { ...nav, index: nav.index - 1 } : nav);
export const goForward = (nav: NavState): NavState => (canGoForward(nav) ? { ...nav, index: nav.index + 1 } : nav);
