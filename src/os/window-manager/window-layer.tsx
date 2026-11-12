"use client";

import { useWM } from "../system/kernel-context";
import { WindowFrame } from "./window-frame";

/**
 * Hosts every open window. It is its own stacking context, so window z-indexes
 * can grow without ever overlapping the taskbar, menus or toasts above it.
 */
export function WindowLayer() {
  const windows = useWM((s) => s.windows);
  return (
    <div className="pointer-events-none absolute inset-0 isolate z-10" data-testid="window-layer">
      {windows.map((w) => (
        <WindowFrame key={w.id} id={w.id} />
      ))}
    </div>
  );
}
