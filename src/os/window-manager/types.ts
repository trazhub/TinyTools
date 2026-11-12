import type { Rect, Size } from "./geometry";

/** Launch arguments for an app window. Must be JSON-serialisable (they are saved for the session). */
export type AppProps = Record<string, unknown>;

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  /** Normal (restored) bounds. While maximized, the window is drawn to fill the work area instead. */
  rect: Rect;
  minimized: boolean;
  maximized: boolean;
  /** Stacking order; the highest value is the front-most window. */
  z: number;
  minSize: Size;
  resizable: boolean;
  props: AppProps;
}

export interface WMState {
  windows: WindowState[];
  focusedId: string | null;
  nextZ: number;
  nextId: number;
  /** Where windows may live: the viewport minus the taskbar. */
  workArea: Rect;
  /** Last bounds per app, so reopening an app puts it back where you left it. */
  lastBounds: Record<string, Rect>;
  /** Counter used to cascade newly opened windows. */
  cascade: number;
}

export interface OpenWindowInput {
  appId: string;
  title: string;
  size: Size;
  minSize: Size;
  resizable: boolean;
  singleton?: boolean;
  props?: AppProps;
}

export type WMAction =
  | ({ type: "open" } & OpenWindowInput)
  | { type: "close"; id: string }
  | { type: "closeAll" }
  | { type: "focus"; id: string }
  | { type: "minimize"; id: string }
  | { type: "restore"; id: string }
  /** Taskbar click: restore if minimized, minimize if already focused, otherwise focus. */
  | { type: "toggleFromTaskbar"; id: string }
  | { type: "maximize"; id: string }
  | { type: "unmaximize"; id: string }
  | { type: "toggleMaximize"; id: string }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "resize"; id: string; rect: Rect }
  | { type: "setTitle"; id: string; title: string }
  | { type: "setWorkArea"; rect: Rect }
  | { type: "hydrate"; state: Pick<WMState, "windows" | "focusedId" | "nextZ" | "nextId" | "lastBounds"> };
