import type { LucideIcon } from "lucide-react";
import { createStore, type Store } from "../lib/store";

export interface MenuAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Display only, e.g. "F2". The shortcut itself must be wired by the app. */
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Shows a check mark (for toggles and the current choice in a list). */
  checked?: boolean;
  onSelect: () => void;
}

export type MenuItem = MenuAction | { id: string; separator: true };

export interface OpenMenu {
  x: number;
  y: number;
  items: MenuItem[];
  /** The element that had focus, so it can be restored when the menu closes. */
  returnFocus: HTMLElement | null;
}

export interface MenuStore {
  state: Store<OpenMenu | null>;
  /** When the menu was last opened, used to ignore the duplicate of a long-press. */
  lastOpenedAt: () => number;
  open(items: MenuItem[], x: number, y: number): void;
  close(): void;
}

export function createMenuStore(): MenuStore {
  const state = createStore<OpenMenu | null>(null);
  let openedAt = 0;
  return {
    state,
    lastOpenedAt: () => openedAt,
    open(items, x, y) {
      const tidy = tidySeparators(items);
      if (tidy.length === 0) return;
      openedAt = Date.now();
      const active = typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null;
      state.set({ x, y, items: tidy, returnFocus: active });
    },
    close() {
      state.set(null);
    },
  };
}

export function isSeparator(item: MenuItem): item is { id: string; separator: true } {
  return "separator" in item;
}

/** Drop separators that would sit at the start or end of the menu, or next to each other. */
export function tidySeparators(items: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const item of items) {
    if (isSeparator(item) && (out.length === 0 || isSeparator(out[out.length - 1]!))) continue;
    out.push(item);
  }
  while (out.length > 0 && isSeparator(out[out.length - 1]!)) out.pop();
  return out;
}

export const separator = (id: string): MenuItem => ({ id, separator: true });
