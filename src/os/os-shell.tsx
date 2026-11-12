"use client";

import { useEffect, useRef } from "react";
import { ComputerLauncher } from "./launcher/computer-launcher";
import { computeWorkArea, isMobileWidth } from "./layout";
import { DialogueBox } from "./room/dialogue-box";
import { Dock } from "./room/dock";
import { Hud } from "./room/hud";
import { RoomView } from "./room/room-view";
import { DialogHost } from "./system/dialog-host";
import type { Kernel } from "./system/kernel";
import { KernelProvider, useKernel, usePrefs, useUI } from "./system/kernel-context";
import { MenuHost } from "./system/menu-host";
import { useGlobalShortcuts } from "./system/shortcuts";
import { ToastHost } from "./system/toast-host";
import { WindowSwitcher } from "./system/window-switcher";
import { persistSession } from "./window-manager/session";
import { WindowLayer } from "./window-manager/window-layer";

/** The running room: the scene, the windows that open over it, and the overlays above them. */
export function OSShell({ kernel, onLeave }: { kernel: Kernel; onLeave: () => void }) {
  return (
    <KernelProvider kernel={kernel}>
      <ShellContents onLeave={onLeave} />
    </KernelProvider>
  );
}

function ShellContents({ onLeave }: { onLeave: () => void }) {
  const kernel = useKernel();
  const prefs = usePrefs();
  const width = useUI((s) => s.width);
  const height = useUI((s) => s.height);
  const mobile = useUI((s) => s.mobile);
  const rootRef = useRef<HTMLElement>(null);
  const announced = useRef(false);

  useGlobalShortcuts(kernel);

  // Track the screen size: it decides the work area for windows and whether we are in phone mode.
  useEffect(() => {
    const el = rootRef.current;
    const measure = () => {
      const w = el?.clientWidth || window.innerWidth;
      const h = el?.clientHeight || window.innerHeight;
      const m = isMobileWidth(w);
      kernel.ui.set((s) => (s.width === w && s.height === h && s.mobile === m ? s : { ...s, width: w, height: h, mobile: m }));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (el) observer?.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [kernel]);

  useEffect(() => {
    kernel.wm.dispatch({ type: "setWorkArea", rect: computeWorkArea(width, height) });
  }, [kernel, width, height]);

  // Remember open windows for this tab so a reload brings them back.
  useEffect(() => persistSession(kernel.wm), [kernel]);

  // One-time notice if the browser won't let us save. The ref keeps React's dev double-effect from repeating it.
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    if (!kernel.fs.persistent) {
      kernel.notify({ tone: "warning", title: "Files won't be saved", message: "Your browser is blocking storage, so files and notes will be lost when you close this tab.", duration: 12_000 });
    }
  }, [kernel]);

  return (
    <main ref={rootRef} id="main" aria-label="TinyTools OS: your room" data-testid="os-root" data-mobile={mobile} className="fixed inset-0 overflow-hidden bg-[var(--px-stage-bg)]">
      <RoomView />
      <WindowLayer />
      <Hud onLeave={onLeave} />
      <Dock />
      <ComputerLauncher />
      <DialogueBox />
      <WindowSwitcher />
      <MenuHost />
      <ToastHost />
      <DialogHost />
      {prefs.crt && <div aria-hidden data-testid="crt-overlay" className="px-crt pointer-events-none absolute inset-0 z-[99999]" />}
    </main>
  );
}
