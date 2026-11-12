"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { MotionMode } from "../settings/prefs";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => serverValue);
}

/** True when animations should be minimised: forced on in Settings, or requested by the system. */
export function useReducedMotion(mode: MotionMode): boolean {
  const system = useMediaQuery(REDUCED_QUERY, false);
  return mode === "reduce" || (mode === "system" && system);
}

/**
 * Re-renders when the time crosses a `granularityMs` boundary (60000 for minutes,
 * 1000 for seconds). Returns the start of the current bucket as a Date.
 */
export function useNow(granularityMs: number): Date {
  const subscribe = useCallback((cb: () => void) => {
    const timer = setInterval(cb, 1000);
    return () => clearInterval(timer);
  }, []);
  const bucket = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / granularityMs),
    () => 0,
  );
  return new Date(bucket * granularityMs);
}

export function useOnline(): boolean {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("online", cb);
    window.addEventListener("offline", cb);
    return () => {
      window.removeEventListener("online", cb);
      window.removeEventListener("offline", cb);
    };
  }, []);
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
