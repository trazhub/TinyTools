"use client";

import { useEffect } from "react";
import { byRecency } from "../window-manager/reducer";
import type { Kernel } from "./kernel";

/**
 * Global keyboard shortcuts. We only claim combinations browsers leave alone:
 *
 *  - Ctrl/Cmd + K       open or close the app launcher
 *  - Alt + `            cycle windows (hold Alt, press ` repeatedly, release to switch)
 *  - Alt + Tab          same, where the browser is allowed to see it (most desktops
 *                       reserve Alt+Tab for the real operating system)
 *  - Escape             closes menus and the launcher (handled by those components)
 *
 * Ctrl+W, Ctrl+T, Ctrl+N, F5 and friends are deliberately left to the browser.
 */
export function useGlobalShortcuts(kernel: Kernel): void {
  useEffect(() => {
    const cancelSwitcher = () => kernel.ui.set((s) => (s.switcher ? { ...s, switcher: null } : s));

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        kernel.menus.close();
        kernel.setLauncherOpen(!kernel.ui.get().launcherOpen);
        return;
      }

      const isCycleKey = e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "Tab" || e.code === "Backquote");
      if (isCycleKey) {
        const count = kernel.wm.getState().windows.length;
        if (count === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? -1 : 1;
        kernel.ui.set((s) => ({
          ...s,
          launcherOpen: false,
          switcher: { index: s.switcher ? (s.switcher.index + step + count) % count : count > 1 ? (step === 1 ? 1 : count - 1) : 0 },
        }));
        return;
      }

      if (e.key === "Escape" && kernel.ui.get().switcher) {
        e.preventDefault();
        cancelSwitcher();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      const switcher = kernel.ui.get().switcher;
      if (!switcher) return;
      const target = byRecency(kernel.wm.getState().windows)[switcher.index];
      kernel.ui.set((s) => ({ ...s, switcher: null }));
      if (target) kernel.wm.dispatch({ type: "focus", id: target.id });
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", cancelSwitcher);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", cancelSwitcher);
    };
  }, [kernel]);
}
