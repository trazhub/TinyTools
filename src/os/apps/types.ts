import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { Size } from "../window-manager/geometry";
import type { AppProps } from "../window-manager/types";

export type AppCategory = "system" | "productivity" | "utilities" | "media" | "internet" | "games";

export const CATEGORY_LABELS: Record<AppCategory, string> = {
  system: "System",
  productivity: "Productivity",
  utilities: "Utilities",
  media: "Media",
  internet: "Internet",
  games: "Games",
};

/** What every app component receives. */
export interface AppComponentProps {
  windowId: string;
  /** Launch arguments, e.g. the folder to show. They can change while the window is open (re-opening a singleton). */
  props: AppProps;
}

export interface AppDefinition {
  id: string;
  name: string;
  description: string;
  category: AppCategory;
  /** Extra words that make the app findable in search. */
  keywords: readonly string[];
  icon: LucideIcon;
  /** OKLCH hue (0-360) for the app's icon tile. */
  hue: number;
  size: Size;
  minSize: Size;
  /** Defaults to true. */
  resizable?: boolean;
  /** Only one window at a time; opening again focuses the existing one. */
  singleton?: boolean;
  component: ComponentType<AppComponentProps>;
}
