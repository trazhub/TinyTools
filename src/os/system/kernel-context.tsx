"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useStore } from "../lib/store";
import { DEFAULT_PREFS, type Prefs } from "../settings/prefs";
import type { WMState } from "../window-manager/types";
import type { Kernel, UIState } from "./kernel";

const KernelContext = createContext<Kernel | null>(null);

export function KernelProvider({ kernel, children }: { kernel: Kernel; children: ReactNode }) {
  return <KernelContext.Provider value={kernel}>{children}</KernelContext.Provider>;
}

export function useKernel(): Kernel {
  const kernel = useContext(KernelContext);
  if (!kernel) throw new Error("useKernel must be used inside <KernelProvider>");
  return kernel;
}

/** Subscribe to part of the window manager state. The selector must return a stable value. */
export function useWM<T>(selector: (state: WMState) => T): T {
  const { wm } = useKernel();
  return useSyncExternalStore(
    wm.subscribe,
    () => selector(wm.getState()),
    () => selector(wm.getState()),
  );
}

export function useUI<T>(selector: (state: UIState) => T): T {
  return useStore(useKernel().ui, selector);
}

export function usePrefs(): Prefs {
  const { prefs } = useKernel();
  return useSyncExternalStore(prefs.subscribe, prefs.get, () => DEFAULT_PREFS);
}

/** Re-render whenever anything in the filesystem changes. Returns the change counter. */
export function useFsVersion(): number {
  const { fs } = useKernel();
  return useSyncExternalStore(fs.subscribe, fs.getVersion, fs.getVersion);
}

/** Keep a window's title in sync with the app's content (e.g. the open document's name). */
export function useWindowTitle(windowId: string, title: string): void {
  const { wm } = useKernel();
  useEffect(() => {
    wm.dispatch({ type: "setTitle", id: windowId, title });
  }, [wm, windowId, title]);
}
