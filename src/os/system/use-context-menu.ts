"use client";

import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import type { MenuItem } from "./menus";
import { useKernel } from "./kernel-context";

const LONG_PRESS_MS = 550;
const MOVE_TOLERANCE = 8;

/**
 * Props that make an element open a context menu on right-click, the keyboard
 * menu key, or a long-press on touch screens (iOS never fires `contextmenu`).
 * `consumeLongPress()` lets a click handler ignore the click that ends a long-press.
 */
export function useContextMenu(getItems: () => MenuItem[], options: { stopPropagation?: boolean } = {}) {
  const kernel = useKernel();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const itemsRef = useRef(getItems);

  useEffect(() => {
    itemsRef.current = getItems;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    origin.current = null;
  }, []);

  // Typed with the event parameter so callers can pass the handler straight to onPointerUp/onPointerCancel.
  const endPress: (e: PointerEvent) => void = () => cancel();

  const props = {
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      if (options.stopPropagation) e.stopPropagation();
      kernel.showMenu(itemsRef.current(), e.clientX, e.clientY);
    },
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      longPressed.current = false;
      const { clientX: x, clientY: y } = e;
      origin.current = { x, y };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        // Android fires its own contextmenu event at about the same moment; don't open twice.
        if (Date.now() - kernel.menus.lastOpenedAt() < 1000) return;
        longPressed.current = true;
        kernel.showMenu(itemsRef.current(), x, y);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_TOLERANCE) cancel();
    },
    onPointerUp: endPress,
    onPointerCancel: endPress,
  };

  const consumeLongPress = () => {
    const was = longPressed.current;
    longPressed.current = false;
    return was;
  };

  return { props, consumeLongPress };
}
