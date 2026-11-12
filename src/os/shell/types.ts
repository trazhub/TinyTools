import type { FsNode } from "../filesystem/types";
import type { VirtualFileSystem } from "../filesystem/vfs";
import type { Prefs } from "../settings/prefs";

export type Tone = "default" | "dir" | "error" | "muted" | "accent" | "success" | "warn";

export interface Segment {
  text: string;
  tone?: Tone;
}

/** One line of terminal output, made of coloured segments. */
export type Line = Segment[];

export interface ShellApp {
  id: string;
  name: string;
  description: string;
}

export interface SystemInfo {
  browser: string;
  platform: string;
  language: string;
  screen: string;
  viewport: string;
  online: boolean;
}

export type OpenResult = { ok: true; name: string } | { ok: false; error: string };

/** Everything the shell may touch. It cannot reach anything outside TinyTools OS. */
export interface ShellContext {
  fs: VirtualFileSystem;
  /** Current directory (a filesystem node id). */
  cwd: string;
  apps: readonly ShellApp[];
  running: () => { appId: string; title: string }[];
  openApp: (idOrName: string) => OpenResult;
  openNode: (node: FsNode) => OpenResult;
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  now: () => Date;
  bootedAt: number;
  history: readonly string[];
  system: SystemInfo;
  themeOptions: { themes: readonly string[] };
}

export interface CommandResult {
  /** Standard output. */
  lines?: Line[];
  /** Standard error, always shown (never redirected). */
  errors?: string[];
  cwd?: string;
  clear?: boolean;
  exit?: boolean;
}

export interface Command {
  name: string;
  summary: string;
  usage: string;
  run: (args: string[], ctx: ShellContext) => CommandResult;
}
