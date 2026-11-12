import type { Palette, PixelCanvas } from "./canvas";
import * as S from "./sprites";

/** Every sprite id and how to draw it. `variant` selects animation frames and similar variations. */
const BUILDERS = {
  shell: () => S.roomShell(),
  rug: () => S.rug(),
  window: (v: string) => S.windowSprite((v || "night") as S.SkyKind),
  posterMountain: () => S.posterMountain(),
  posterSign: () => S.posterSign(),
  posterSunset: () => S.posterSunset(),
  posterPlanet: () => S.posterPlanet(),
  noteA: () => S.pinnedNote(0),
  noteB: () => S.pinnedNote(1),
  bookshelf: () => S.bookshelf(),
  bed: () => S.bed(),
  nightstand: () => S.nightstand(),
  desk: () => S.desk(),
  chair: () => S.chair(),
  crt: (v: string) => S.crt(v !== "off"),
  tower: () => S.tower(),
  keyboard: () => S.keyboard(),
  mug: () => S.mug(),
  steam: (v: string) => S.mugSteam(Number(v) || 0),
  lamp: () => S.lamp(),
  plantBig: () => S.plantBig(),
  plantMid: () => S.plantMid(),
  plantSmall: () => S.plantSmall(),
  vines: () => S.vines(),
  catBed: (v: string) => S.catSleeping("grey", Number(v) || 0),
  catCushion: (v: string) => S.catSleeping("orange", Number(v) || 0),
  catShelf: (v: string) => S.catSitting("dark", Number(v) || 0),
  cushion: () => S.cushion(),
  character: (v: string) => S.character(Number(v) || 0),
  portrait: (v: string) => S.portrait(v === "blink"),
  notebook: () => S.notebook(),
  handheld: () => S.handheld(),
  recordPlayer: () => S.recordPlayer(),
  alarmClock: (v: string) => S.alarmClock(v || "00:00"),
  sparkle: () => S.sparkle(),
  heart: () => S.heart(),
  note: () => S.musicNote(),
  logoStar: () => S.logoStar(),
  iconHome: () => S.iconHome(),
  iconSoundOn: () => S.iconSound(true),
  iconSoundOff: () => S.iconSound(false),
  iconGear: () => S.iconGear(),
  iconArrow: () => S.iconArrow(),
  dialogueArrow: () => S.dialogueArrow(),
  cursorArrow: () => S.cursorArrow(),
  cursorHand: () => S.cursorHand(),
} satisfies Record<string, (variant: string) => PixelCanvas>;

export type SpriteId = keyof typeof BUILDERS;

const canvasCache = new Map<string, PixelCanvas>();
const urlCache = new Map<string, string>();

export function buildSprite(id: SpriteId, variant = ""): PixelCanvas {
  const key = `${id}|${variant}`;
  let canvas = canvasCache.get(key);
  if (!canvas) {
    canvas = (BUILDERS[id] as (v: string) => PixelCanvas)(variant);
    canvasCache.set(key, canvas);
  }
  return canvas;
}

export function spriteSize(id: SpriteId, variant = ""): { width: number; height: number } {
  const { width, height } = buildSprite(id, variant);
  return { width, height };
}

/** A cached data-URL image of the sprite in the given palette. */
export function spriteUrl(id: SpriteId, variant: string, palette: Palette, paletteId: string): string {
  const key = `${paletteId}|${id}|${variant}`;
  let url = urlCache.get(key);
  if (!url) {
    url = buildSprite(id, variant).toDataUrl(palette);
    urlCache.set(key, url);
  }
  return url;
}

export const SPRITE_IDS = Object.keys(BUILDERS) as SpriteId[];
