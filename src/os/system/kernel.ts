import type { AppDefinition } from "../apps/types";
import type { FsNode } from "../filesystem/types";
import type { VirtualFileSystem } from "../filesystem/vfs";
import { createStore, type Store } from "../lib/store";
import type { PrefsStore } from "../settings/prefs-store";
import type { Rect } from "../window-manager/geometry";
import { createWindowStore, type WindowStore } from "../window-manager/store";
import type { AppProps } from "../window-manager/types";
import { createDialogStore, type ConfirmOptions, type DialogStore, type PromptOptions } from "./dialogs";
import { createDialogueStore, type DialogueStore } from "./dialogue";
import { appForNode } from "./files";
import { createMenuStore, type MenuItem, type MenuStore } from "./menus";
import { createMusicPlayer, type MusicPlayer } from "./music";
import { createToastStore, type ToastInput, type ToastStore } from "./notifications";
import { createSoundEngine, type SfxName, type SoundEngine } from "./sound";

export interface UIState {
  launcherOpen: boolean;
  /** Set while the Alt+` / Alt+Tab window switcher is showing. */
  switcher: { index: number } | null;
  /** Narrow screens use full-screen windows. */
  mobile: boolean;
  width: number;
  height: number;
  /** A room object that is flashing to point it out (used by the tour). */
  highlightId: string | null;
}

export type PowerMode = "shutdown" | "restart";
export type KernelOpenResult = { ok: true; name: string } | { ok: false; error: string };

export interface RoomEffect {
  id: number;
  kind: "heart" | "sparkle" | "note";
  x: number;
  y: number;
}

/**
 * The running world: window manager, filesystem, preferences, and the shared
 * services (toasts, dialogs, menus, dialogue, sound, music). One kernel exists per
 * visit to the room; apps reach it through React context.
 */
export interface Kernel {
  wm: WindowStore;
  fs: VirtualFileSystem;
  prefs: PrefsStore;
  toasts: ToastStore;
  dialogs: DialogStore;
  menus: MenuStore;
  dialogue: DialogueStore;
  sound: SoundEngine;
  music: MusicPlayer;
  ui: Store<UIState>;
  /** Floating hearts, sparkles and notes in the room. */
  effects: Store<readonly RoomEffect[]>;
  apps: readonly AppDefinition[];
  bootedAt: number;

  getApp(id: string): AppDefinition | undefined;
  openApp(appId: string, props?: AppProps): string | null;
  openNode(node: FsNode): KernelOpenResult;
  closeWindow(id: string): void;
  notify(input: ToastInput): number;
  confirm(options: ConfirmOptions): Promise<boolean>;
  prompt(options: PromptOptions): Promise<string | null>;
  showMenu(items: MenuItem[], x: number, y: number): void;
  setLauncherOpen(open: boolean): void;
  /** Play a sound effect (does nothing while sound is off). */
  sfx(name: SfxName): void;
  /** Spawn a floating effect at room (stage) coordinates. */
  spawnEffect(kind: RoomEffect["kind"], x: number, y: number): void;
  requestPower(mode: PowerMode): void;
}

export interface KernelOptions {
  fs: VirtualFileSystem;
  prefs: PrefsStore;
  apps: readonly AppDefinition[];
  workArea?: Rect;
  bootedAt?: number;
  onPowerRequest?: (mode: PowerMode) => void;
}

export function createKernel(options: KernelOptions): Kernel {
  const { fs, prefs, apps } = options;
  const wm = createWindowStore(options.workArea);
  const toasts = createToastStore();
  const dialogs = createDialogStore();
  const menus = createMenuStore();
  const dialogue = createDialogueStore();
  const sound = createSoundEngine(() => prefs.get().sound);
  const music = createMusicPlayer(() => sound.context(), () => prefs.get().musicVolume);
  const ui = createStore<UIState>({ launcherOpen: false, switcher: null, mobile: false, width: 1280, height: 720, highlightId: null });
  const effects = createStore<readonly RoomEffect[]>([]);
  const byId = new Map(apps.map((a) => [a.id, a]));
  let effectId = 1;

  // When a conversation ends, stop pointing at any object.
  dialogue.state.subscribe(() => {
    if (!dialogue.state.get()) ui.set((s) => (s.highlightId ? { ...s, highlightId: null } : s));
  });

  // Muting sound also silences the music; adjusting the volume applies live.
  let lastSound = prefs.get().sound;
  let lastVolume = prefs.get().musicVolume;
  prefs.subscribe(() => {
    const p = prefs.get();
    if (!p.sound && lastSound) music.stop();
    if (p.musicVolume !== lastVolume) music.setVolume(p.musicVolume);
    lastSound = p.sound;
    lastVolume = p.musicVolume;
  });

  // Tell the user when saving fails instead of silently losing their work.
  let lastPersistWarning = 0;
  fs.onPersistError = (error) => {
    if (Date.now() - lastPersistWarning < 10_000) return;
    lastPersistWarning = Date.now();
    const full = error instanceof DOMException && error.name === "QuotaExceededError";
    toasts.notify({
      tone: "error",
      title: "Couldn't save your changes",
      message: full ? "Browser storage is full. Delete some files or export them to your computer." : "Your browser refused to save. Recent changes may be lost if you close this tab.",
    });
  };

  const kernel: Kernel = {
    wm,
    fs,
    prefs,
    toasts,
    dialogs,
    menus,
    dialogue,
    sound,
    music,
    ui,
    effects,
    apps,
    bootedAt: options.bootedAt ?? Date.now(),

    getApp: (id) => byId.get(id),

    openApp(appId, props) {
      const app = byId.get(appId);
      if (!app) return null;
      const before = wm.getState().windows.length;
      wm.dispatch({
        type: "open",
        appId,
        title: app.name,
        size: app.size,
        minSize: app.minSize,
        resizable: app.resizable ?? true,
        ...(app.singleton ? { singleton: true } : {}),
        ...(props ? { props } : {}),
      });
      if (wm.getState().windows.length > before) sound.play("open");
      ui.set((s) => (s.launcherOpen ? { ...s, launcherOpen: false } : s));
      dialogue.close();
      return wm.getState().focusedId;
    },

    openNode(node) {
      const target = appForNode(node);
      const app = byId.get(target.appId);
      if (!app) return { ok: false, error: `The ${target.appId} app isn't installed.` };
      kernel.openApp(target.appId, target.props);
      return { ok: true, name: app.name };
    },

    closeWindow(id) {
      wm.dispatch({ type: "close", id });
      sound.play("close");
    },
    notify: (input) => toasts.notify(input),
    confirm: (o) => dialogs.confirm(o),
    prompt: (o) => dialogs.prompt(o),
    showMenu: (items, x, y) => menus.open(items, x, y),
    setLauncherOpen: (open) => ui.set((s) => (s.launcherOpen === open ? s : { ...s, launcherOpen: open })),
    sfx: (name) => sound.play(name),
    spawnEffect(kind, x, y) {
      const id = effectId++;
      effects.set((prev) => [...prev.slice(-8), { id, kind, x, y }]);
      setTimeout(() => effects.set((prev) => prev.filter((e) => e.id !== id)), 1300);
    },
    requestPower: (mode) => options.onPowerRequest?.(mode),
  };
  return kernel;
}
