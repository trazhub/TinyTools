"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { APPS } from "./apps/registry";
import { computeWorkArea, isMobileWidth } from "./layout";
import { openBestAdapter } from "./filesystem/adapters";
import { VirtualFileSystem } from "./filesystem/vfs";
import { PixelProvider } from "./pixel/pixel-context";
import { buildPalette } from "./pixel/palette";
import { buildSprite } from "./pixel/registry";
import { OSShell } from "./os-shell";
import { BootScreen, TitleScreen } from "./room/title-screen";
import { applyPrefsToDocument } from "./settings/apply";
import { DEFAULT_PREFS } from "./settings/prefs";
import { createPrefsStore, type PrefsStore } from "./settings/prefs-store";
import { readJson, writeJson } from "./storage/safe-storage";
import { createKernel, type Kernel } from "./system/kernel";
import { KernelProvider } from "./system/kernel-context";
import { clearSession, loadSession } from "./window-manager/session";

// One filesystem and one preferences store exist for the life of the page. Leaving the room and
// coming back creates a fresh kernel (and closes windows) but reuses these.
let filesystem: Promise<VirtualFileSystem> | null = null;
let prefsStore: PrefsStore | null = null;

function getPrefsStore(): PrefsStore {
  prefsStore ??= createPrefsStore();
  return prefsStore;
}

function loadFilesystem() {
  filesystem ??= (async () => {
    const { adapter, persistent } = await openBestAdapter();
    return VirtualFileSystem.open(adapter, { persistent });
  })();
  return filesystem;
}

const subscribePrefs = (cb: () => void) => getPrefsStore().subscribe(cb);
const readPrefs = () => getPrefsStore().get();

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const MIN_BOOT_MS = 600;
const VISITED_KEY = "tinytools-os:visited";

async function boot(options: { restore: boolean; onPowerRequest: () => void }): Promise<Kernel> {
  const started = performance.now();
  const fs = await loadFilesystem();
  const prefs = getPrefsStore();

  const w = window.innerWidth;
  const h = window.innerHeight;
  const kernel = createKernel({ fs, prefs, apps: APPS, workArea: computeWorkArea(w, h), onPowerRequest: options.onPowerRequest });
  kernel.ui.set((s) => ({ ...s, width: w, height: h, mobile: isMobileWidth(w) }));

  if (options.restore) {
    loadSession(kernel.wm, (id) => {
      const app = kernel.getApp(id);
      return app ? { minSize: app.minSize, resizable: app.resizable ?? true } : undefined;
    });
  }

  const motion = prefs.get().motion;
  const reduced = motion === "reduce" || (motion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  await delay(reduced ? 0 : Math.max(0, MIN_BOOT_MS - (performance.now() - started)));
  return kernel;
}

type Phase = { name: "booting"; restore: boolean } | { name: "title"; kernel: Kernel; returning: boolean } | { name: "room"; kernel: Kernel };

export function OSRoot() {
  const [phase, setPhase] = useState<Phase>({ name: "booting", restore: true });
  const prefs = useSyncExternalStore(subscribePrefs, readPrefs, () => DEFAULT_PREFS);

  // Keep <html> in step with preferences (theme, motion), even while booting.
  useEffect(() => applyPrefsToDocument(prefs), [prefs]);

  // Pixel mouse cursors, drawn in the current theme.
  useEffect(() => {
    const palette = buildPalette(prefs.theme, prefs.hoodie);
    const root = document.documentElement.style;
    root.setProperty("--px-arrow", `url("${buildSprite("cursorArrow").toDataUrl(palette, 2)}") 1 1, default`);
    root.setProperty("--px-hand", `url("${buildSprite("cursorHand").toDataUrl(palette, 2)}") 9 2, pointer`);
  }, [prefs.theme, prefs.hoodie]);

  useEffect(() => {
    if (phase.name !== "booting") return;
    let cancelled = false;
    const returning = readJson("local", VISITED_KEY) !== undefined;
    boot({
      restore: phase.restore,
      onPowerRequest: () => setPhase((p) => (p.name === "room" ? { name: "title", kernel: p.kernel, returning: true } : p)),
    })
      .then((kernel) => {
        if (!cancelled) setPhase({ name: "title", kernel, returning });
      })
      .catch((error: unknown) => console.error("[TinyTools OS] boot failed", error));
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const leaveRoom = (kernel: Kernel) => {
    kernel.dialogue.close();
    kernel.music.stop();
    kernel.menus.close();
    kernel.setLauncherOpen(false);
    kernel.wm.dispatch({ type: "closeAll" });
    clearSession();
    setPhase({ name: "title", kernel, returning: true });
  };

  const enterRoom = (kernel: Kernel, then?: () => void) => {
    writeJson("local", VISITED_KEY, true);
    kernel.sfx("open");
    setPhase({ name: "room", kernel });
    then?.();
  };

  return (
    <PixelProvider themeId={prefs.theme} hoodieId={prefs.hoodie}>
      {phase.name === "booting" && <BootScreen />}
      {phase.name === "title" && (
        <KernelProvider kernel={phase.kernel}>
          <TitleScreen
            returning={phase.returning}
            onEnter={() => enterRoom(phase.kernel)}
            onOpenSettings={() => enterRoom(phase.kernel, () => phase.kernel.openApp("settings"))}
          />
        </KernelProvider>
      )}
      {phase.name === "room" && <OSShell kernel={phase.kernel} onLeave={() => leaveRoom(phase.kernel)} />}
    </PixelProvider>
  );
}
