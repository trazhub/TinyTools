export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Height of a window's title bar. A window can never be dragged so this part leaves the work area. */
export const TITLEBAR_HEIGHT = 40;
/** Minimum horizontal sliver of a window that must stay on screen. */
export const MIN_VISIBLE_X = 96;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Keep a window reachable: its title bar must remain inside the work area and
 * at least MIN_VISIBLE_X pixels of it must be visible horizontally.
 */
export function clampPosition(rect: Rect, area: Rect): Rect {
  return {
    ...rect,
    x: clamp(rect.x, area.x - rect.width + MIN_VISIBLE_X, area.x + area.width - MIN_VISIBLE_X),
    y: clamp(rect.y, area.y, area.y + area.height - TITLEBAR_HEIGHT),
  };
}

/** Shrink to fit the work area (respecting minimum size), then clamp position. */
export function fitToArea(rect: Rect, area: Rect, min: Size): Rect {
  const width = Math.max(Math.min(rect.width, area.width), Math.min(min.width, area.width));
  const height = Math.max(Math.min(rect.height, area.height), Math.min(min.height, area.height));
  return clampPosition({ ...rect, width, height }, area);
}

/** Compute the new bounds while dragging a resize handle. */
export function computeResize(start: Rect, dir: ResizeDir, dx: number, dy: number, min: Size, area: Rect): Rect {
  let { x, y, width, height } = start;
  const right = start.x + start.width;
  const bottom = start.y + start.height;

  if (dir.includes("e")) width = Math.max(min.width, start.width + dx);
  if (dir.includes("s")) height = Math.max(min.height, start.height + dy);
  if (dir.includes("w")) {
    width = Math.max(min.width, start.width - dx);
    x = right - width;
  }
  if (dir.includes("n")) {
    // The top edge may not go above the work area.
    const top = Math.max(area.y, start.y + dy);
    height = Math.max(min.height, bottom - top);
    y = bottom - height;
  }
  return { x, y, width, height };
}
