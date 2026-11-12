"use client";

import { AppIcon } from "../apps/app-icon";
import { byRecency } from "../window-manager/reducer";
import { useKernel, useUI, useWM } from "./kernel-context";
import { cn } from "@/lib/utils";

/**
 * The Alt+Tab / Alt+` overlay. Hold Alt and keep pressing the key to move through
 * windows (most recently used first); releasing Alt switches to the highlighted one.
 */
export function WindowSwitcher() {
  const kernel = useKernel();
  const switcher = useUI((s) => s.switcher);
  const windows = useWM((s) => s.windows);
  if (!switcher) return null;

  const ordered = byRecency(windows);
  const index = Math.min(switcher.index, ordered.length - 1);

  return (
    <div className="pointer-events-none absolute inset-0 z-[9850] grid place-items-center">
      <div role="dialog" aria-label="Switch windows" className="px-panel os-chrome pointer-events-auto max-w-[90vw] animate-pop-in rounded-2xl p-3">
        <ul role="listbox" aria-label="Open windows" className="flex gap-2 overflow-x-auto">
          {ordered.map((w, i) => {
            const app = kernel.getApp(w.appId);
            return (
              <li
                key={w.id}
                role="option"
                aria-selected={i === index}
                onClick={() => {
                  kernel.wm.dispatch({ type: "focus", id: w.id });
                  kernel.ui.set((s) => ({ ...s, switcher: null }));
                }}
                className={cn("flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl p-3", i === index ? "bg-foreground/15 ring-2 ring-primary" : "hover:bg-foreground/5")}
              >
                {app && <AppIcon app={app} size={44} />}
                <span className="w-full truncate text-center text-xs font-medium">{w.title}</span>
                {w.minimized && <span className="text-[10px] text-muted-foreground">minimized</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
