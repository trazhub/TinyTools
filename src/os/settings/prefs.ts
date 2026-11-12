import { DEFAULT_THEME_ID, HOODIES, ROOM_THEMES } from "../pixel/palette";
import { isRecord } from "../storage/safe-storage";

export type MotionMode = "system" | "reduce" | "full";

export interface Prefs {
  /** Room theme id (see pixel/palette.ts). */
  theme: string;
  /** The overhead light is off; only the desk lamp glows. */
  lightsOff: boolean;
  /** Interface sound effects. Music is separate and always starts off. */
  sound: boolean;
  /** 0 to 1. */
  musicVolume: number;
  /** Scanlines and a soft vignette over everything. */
  crt: boolean;
  motion: MotionMode;
  clock24h: boolean;
  playerName: string;
  hoodie: string;
  /** App ids shown first in the launcher. */
  pinned: string[];
}

export const DEFAULT_PREFS: Prefs = {
  theme: DEFAULT_THEME_ID,
  lightsOff: false,
  sound: true,
  musicVolume: 0.5,
  crt: true,
  motion: "system",
  clock24h: false,
  playerName: "Player",
  hoodie: "blue",
  pinned: ["explorer", "notes", "terminal", "calculator", "settings"],
};

export const PREFS_KEY = "tinytools-os:prefs";
export const PREFS_VERSION = 2;
export const MAX_NAME_LENGTH = 16;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

function stringList(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const out: string[] = [];
  for (const v of value) if (typeof v === "string" && v.length <= 64 && !out.includes(v)) out.push(v);
  return out.slice(0, 64);
}

/** Clean up a display name: no control characters, trimmed, limited length, never empty. */
export function sanitizeName(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_PREFS.playerName;
  const cleaned = value.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH).trim();
  return cleaned || DEFAULT_PREFS.playerName;
}

/**
 * Turn whatever was stored into a valid Prefs object. Each field is validated on
 * its own, so one bad value falls back to its default without losing the rest.
 * (Unknown fields from older versions, like the old taskbar settings, are ignored.)
 */
export function sanitizePrefs(raw: unknown): Prefs {
  const src = isRecord(raw) ? (isRecord(raw.prefs) ? raw.prefs : raw) : {};
  const d = DEFAULT_PREFS;
  const volume = typeof src.musicVolume === "number" && Number.isFinite(src.musicVolume) ? Math.min(1, Math.max(0, src.musicVolume)) : d.musicVolume;
  return {
    theme: oneOf(src.theme, ROOM_THEMES.map((t) => t.id), d.theme),
    lightsOff: bool(src.lightsOff, d.lightsOff),
    sound: bool(src.sound, d.sound),
    musicVolume: volume,
    crt: bool(src.crt, d.crt),
    motion: oneOf(src.motion, ["system", "reduce", "full"], d.motion),
    clock24h: bool(src.clock24h, d.clock24h),
    playerName: sanitizeName(src.playerName),
    hoodie: oneOf(src.hoodie, HOODIES.map((h) => h.id), d.hoodie),
    pinned: stringList(src.pinned, d.pinned),
  };
}
