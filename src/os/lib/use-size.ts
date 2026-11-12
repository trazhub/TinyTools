"use client";

import { useCallback, useRef, useState } from "react";

export interface Size {
  w: number;
  h: number;
}

/**
 * Track an element's size. Returns a callback ref plus the latest size (0x0 until
 * the first measurement). Uses ResizeObserver, plus window resize as a fallback.
 */
export function useElementSize(): [(el: HTMLElement | null) => void, Size] {
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const stop = useRef<(() => void) | null>(null);

  const ref = useCallback((el: HTMLElement | null) => {
    stop.current?.();
    stop.current = null;
    if (!el) return;
    const measure = () => setSize((prev) => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener("resize", measure);
    stop.current = () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return [ref, size];
}
