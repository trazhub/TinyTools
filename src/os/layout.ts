import type { Rect } from "./window-manager/geometry";

/** Height of the top bar (home, sound, settings). */
export const HUD_HEIGHT = 64;
/** Height of the bottom strip (open windows, or quick-access buttons on phones). */
export const DOCK_HEIGHT = 56;
/** Below this width the OS uses full-screen windows and shows quick-access buttons. */
export const MOBILE_BREAKPOINT = 768;

export const isMobileWidth = (width: number) => width < MOBILE_BREAKPOINT;

/** Where windows may live: everything between the top bar and the bottom strip. */
export function computeWorkArea(width: number, height: number): Rect {
  return { x: 0, y: HUD_HEIGHT, width, height: Math.max(0, height - HUD_HEIGHT - DOCK_HEIGHT) };
}
