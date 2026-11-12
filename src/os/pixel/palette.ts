import type { Palette } from "./canvas";

/**
 * The whole game uses roughly 60 colours. Warm and organic colours (wood, plants,
 * skin, lamp light) are shared by every theme; the "cool ramp" (walls, floor,
 * bed, rug, sky) is what a room theme replaces.
 */
const SHARED: Record<string, string> = {
  white: "#ffffff",
  cream: "#f7edd3",
  cream2: "#dccfae",
  amber1: "#ffe3a0",
  amber2: "#ffc866",
  amber3: "#f09a3e",
  amber4: "#c46a2a",
  wood9: "#2f1c14",
  wood8: "#4a2b1c",
  wood7: "#67391f",
  wood6: "#85502b",
  wood5: "#a56c3a",
  wood4: "#c78e55",
  leaf9: "#17402f",
  leaf7: "#2a6a45",
  leaf5: "#48985a",
  leaf3: "#7fc97a",
  rose: "#d9708c",
  red: "#bf4a48",
  skin: "#efbf94",
  skinD: "#cf9468",
  hair: "#2b1e33",
  hairL: "#46344f",
  catG: "#8d8ba8",
  catGD: "#5e5c7a",
  catL: "#c8c4dc",
  catO: "#dd8c4a",
  catOD: "#a8602a",
  catB: "#4c4560",
  steel: "#9a9eb8",
  steelD: "#60647f",
  screen: "#0e1b38",
  screenText: "#d8f0ff",
  ledG: "#66e08a",
  ledR: "#e0605a",
  pot: "#b5562f",
  potD: "#7c3a22",
  pink: "#f0a6c0",
  shadow: "#00000055",
};

export interface RampColors {
  ink: string;
  n9: string;
  n8: string;
  n7: string;
  n6: string;
  p5: string;
  p4: string;
  b5: string;
  b4: string;
  b3: string;
  b2: string;
  lilac: string;
  skyA: string;
  skyB: string;
  skyC: string;
}

export interface RoomTheme {
  id: string;
  name: string;
  blurb: string;
  ramp: RampColors;
  /** Whether the window shows a night sky (stars and moon) or daylight. */
  sky: "night" | "dusk" | "day";
}

export const ROOM_THEMES: readonly RoomTheme[] = [
  {
    id: "midnight",
    name: "Midnight",
    blurb: "Deep navy and purple with warm lamplight.",
    sky: "night",
    ramp: { ink: "#070618", n9: "#0d0c2b", n8: "#15134a", n7: "#1e1b63", n6: "#2b2680", p5: "#3e34a3", p4: "#5a4cc4", b5: "#3a5ab8", b4: "#5d82dc", b3: "#8eb0f2", b2: "#c2d4fb", lilac: "#a395ee", skyA: "#0a0a2e", skyB: "#16154d", skyC: "#2a2170" },
  },
  {
    id: "dusk",
    name: "Dusk",
    blurb: "A purple and magenta twilight.",
    sky: "dusk",
    ramp: { ink: "#12061c", n9: "#1d0b2e", n8: "#2e1146", n7: "#46195e", n6: "#632478", p5: "#8a2f86", p4: "#b0449a", b5: "#6a4fb8", b4: "#9873e0", b3: "#c9a3f2", b2: "#ebd4fa", lilac: "#e19be0", skyA: "#2a0e42", skyB: "#6b2368", skyC: "#e0705a" },
  },
  {
    id: "daylight",
    name: "Daylight",
    blurb: "A bright, airy morning room.",
    sky: "day",
    ramp: { ink: "#2a2748", n9: "#4b4a86", n8: "#6a69a8", n7: "#8c8ccc", n6: "#a9aadd", p5: "#c4b5ee", p4: "#d8c9f6", b5: "#7fa6e6", b4: "#a8c4f2", b3: "#cfe0fb", b2: "#eef4ff", lilac: "#cbb8f5", skyA: "#8cc3f4", skyB: "#b8dcf8", skyC: "#e4f2fc" },
  },
  {
    id: "forest",
    name: "Forest",
    blurb: "Mossy greens and teal.",
    sky: "night",
    ramp: { ink: "#04140f", n9: "#08211b", n8: "#0d3228", n7: "#144a3b", n6: "#1d6350", p5: "#2a806a", p4: "#3fa086", b5: "#2f7f9a", b4: "#4fa5bd", b3: "#86ccd8", b2: "#c0ecee", lilac: "#8fd9b0", skyA: "#07201f", skyB: "#0f3a36", skyC: "#1c5a50" },
  },
];

export const DEFAULT_THEME_ID = "midnight";

export function findTheme(id: string): RoomTheme {
  return ROOM_THEMES.find((t) => t.id === id) ?? ROOM_THEMES[0]!;
}

export interface Hoodie {
  id: string;
  name: string;
  base: string;
  shade: string;
}

export const HOODIES: readonly Hoodie[] = [
  { id: "blue", name: "Blue", base: "#4a72d8", shade: "#34529f" },
  { id: "purple", name: "Purple", base: "#8a62d6", shade: "#6240a3" },
  { id: "teal", name: "Teal", base: "#3fb0a0", shade: "#2a7d72" },
  { id: "rose", name: "Rose", base: "#d9708c", shade: "#a84c68" },
  { id: "amber", name: "Amber", base: "#e8a040", shade: "#b87424" },
  { id: "green", name: "Green", base: "#5cb06a", shade: "#3c7d4a" },
];

export function findHoodie(id: string): Hoodie {
  return HOODIES.find((h) => h.id === id) ?? HOODIES[0]!;
}

/** Full palette for a theme and hoodie colour. */
export function buildPalette(themeId: string, hoodieId: string): Palette {
  const theme = findTheme(themeId);
  const hoodie = findHoodie(hoodieId);
  return { ...SHARED, ...theme.ramp, hood: hoodie.base, hoodD: hoodie.shade };
}

/** Colours used by React overlays (labels, lighting) that must match the artwork. */
export function uiColors(themeId: string) {
  const { ramp } = findTheme(themeId);
  return { panel: ramp.n8, panelDark: ramp.n9, border: ramp.b4, accent: SHARED.amber2!, text: SHARED.cream! };
}
