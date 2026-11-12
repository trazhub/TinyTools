import { PixelCanvas, fromGrid } from "./canvas";

/**
 * Every asset in the room, drawn in code. Sprites use palette keys (see palette.ts),
 * so a theme change recolours all of them. Coordinates are logical pixels; the
 * room stage scales them up by an integer factor.
 */

// ---- helpers ----------------------------------------------------------------

/** Small deterministic RNG so artwork is identical on every load. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A beveled box: lit top/left edge, shaded bottom/right edge. */
function bevel(c: PixelCanvas, x: number, y: number, w: number, h: number, fill: string, hi: string, lo: string) {
  c.rect(x, y, w, h, fill);
  c.hline(x, y, w, hi).vline(x, y, h, hi);
  c.hline(x, y + h - 1, w, lo).vline(x + w - 1, y, h, lo);
}

/** A pointed leaf drawn along an angle (degrees, 0 = right, -90 = up). */
function leaf(c: PixelCanvas, x: number, y: number, angle: number, length: number, width: number, key: string, hi: string | null = null) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  for (let t = 0; t <= length; t++) {
    const w = Math.max(0.6, Math.sin((t / length) * Math.PI) * width);
    const cx = x + dx * t;
    const cy = y + dy * t;
    for (let s = -w; s <= w; s += 0.5) {
      const px = Math.round(cx - dy * s);
      const py = Math.round(cy + dx * s);
      c.set(px, py, hi && s < -w * 0.3 ? hi : key);
    }
  }
}

// ---- the room shell -----------------------------------------------------------

export const STAGE_W = 320;
export const STAGE_H = 180;
export const FLOOR_Y = 113;

export function roomShell(): PixelCanvas {
  const c = new PixelCanvas(STAGE_W, STAGE_H);
  // Wall
  c.rect(0, 0, STAGE_W, FLOOR_Y, "n7");
  for (let x = 0; x < STAGE_W; x += 16) c.vline(x, 6, FLOOR_Y - 12, "n6");
  for (let y = 12; y < FLOOR_Y - 8; y += 16) for (let x = 8; x < STAGE_W; x += 16) c.set(x, y, "n6").set(x - 1, y, "n6").set(x + 1, y, "n6").set(x, y - 1, "n6").set(x, y + 1, "n6");
  // Crown moulding
  c.rect(0, 0, STAGE_W, 6, "n9").hline(0, 5, STAGE_W, "n8").hline(0, 6, STAGE_W, "n6");
  // Baseboard
  c.rect(0, FLOOR_Y - 6, STAGE_W, 6, "n9").hline(0, FLOOR_Y - 6, STAGE_W, "p5").hline(0, FLOOR_Y - 5, STAGE_W, "n6");
  // Floor planks
  c.rect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y, "n8");
  const planks = [FLOOR_Y, FLOOR_Y + 12, FLOOR_Y + 25, FLOOR_Y + 39, FLOOR_Y + 54, FLOOR_Y + 70];
  planks.forEach((py, row) => {
    c.hline(0, py, STAGE_W, "n9");
    const next = planks[row + 1] ?? STAGE_H;
    const offset = row % 2 === 0 ? 0 : 36;
    for (let x = offset; x < STAGE_W; x += 72) c.vline(x, py, next - py, "n9");
    c.hline(0, py + 1, STAGE_W, "n7");
  });
  const rand = rng(7);
  for (let i = 0; i < 90; i++) c.set(Math.floor(rand() * STAGE_W), FLOOR_Y + 2 + Math.floor(rand() * (STAGE_H - FLOOR_Y - 3)), "n7");
  // Vignette along the sides and bottom
  for (let y = 0; y < STAGE_H; y++) {
    for (let x = 0; x < 6; x++) if ((x + y) % 2 === 0 && x < 6 - (y % 3)) c.set(x, y, "n9").set(STAGE_W - 1 - x, y, "n9");
  }
  for (let x = 0; x < STAGE_W; x++) c.set(x, STAGE_H - 1, "n9").set(x, STAGE_H - 2, x % 2 === 0 ? "n9" : "n8");
  return c;
}

export function rug(): PixelCanvas {
  const w = 124;
  const h = 44;
  const c = new PixelCanvas(w, h);
  c.rect(0, 0, w, h, "p5");
  c.rect(3, 3, w - 6, h - 6, "b5");
  c.frame(5, 5, w - 10, h - 10, "b4");
  c.dither(8, 8, w - 16, 3, "b5", "b4").dither(8, h - 11, w - 16, 3, "b5", "b4");
  for (let x = 14; x < w - 14; x += 12) c.set(x, 15, "b3").set(x + 1, 16, "b3").set(x, 17, "b3").set(x - 1, 16, "b3").set(x, 28, "b3").set(x + 1, 27, "b3").set(x, 26, "b3").set(x - 1, 27, "b3");
  // Rounded corners
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [1, 0], [0, 1], [w - 2, 0], [w - 1, 1], [1, h - 1], [0, h - 2], [w - 2, h - 1], [w - 1, h - 2]] as const) c.set(x, y, null);
  return c;
}

/** Soft floor shadow under furniture. */
export function shadow(w: number, h: number): PixelCanvas {
  return new PixelCanvas(w, h).ellipse(0, 0, w, h, "shadow");
}

// ---- wall decor -------------------------------------------------------------------

export type SkyKind = "night" | "dusk" | "day";

export function windowSprite(sky: SkyKind): PixelCanvas {
  const w = 68;
  const h = 70;
  const c = new PixelCanvas(w, h);
  // Frame
  c.rect(0, 0, w, h - 6, "b4");
  c.frame(0, 0, w, h - 6, "ink");
  c.rect(3, 3, w - 6, h - 12, "ink");
  // Sky bands
  const gx = 4;
  const gy = 4;
  const gw = w - 8;
  const gh = h - 14;
  const bands = ["skyA", "skyA", "skyB", "skyB", "skyC", "skyC"];
  bands.forEach((k, i) => c.rect(gx, gy + Math.floor((i * gh) / bands.length), gw, Math.ceil(gh / bands.length), k));
  c.dither(gx, gy + Math.floor(gh * 0.33) - 1, gw, 2, "skyA", "skyB").dither(gx, gy + Math.floor(gh * 0.66) - 1, gw, 2, "skyB", "skyC");
  const rand = rng(11);
  if (sky !== "day") {
    for (let i = 0; i < 16; i++) c.set(gx + 2 + Math.floor(rand() * (gw - 4)), gy + 2 + Math.floor(rand() * 20), i % 4 === 0 ? "b2" : "b3");
    // Crescent moon
    c.ellipse(gx + 38, gy + 6, 11, 11, "cream").ellipse(gx + 41, gy + 4, 11, 11, "skyA");
    if (sky === "dusk") c.rect(gx, gy + gh - 14, gw, 14, "skyC").dither(gx, gy + gh - 16, gw, 2, "skyB", "skyC");
  } else {
    c.ellipse(gx + 38, gy + 5, 9, 9, "amber1");
    c.rect(gx + 6, gy + 10, 12, 3, "white").rect(gx + 9, gy + 8, 7, 3, "white").rect(gx + 30, gy + 24, 14, 3, "white").rect(gx + 33, gy + 22, 7, 3, "white");
  }
  // Skyline
  const roof = sky === "day" ? "n8" : "n9";
  const heights = [14, 20, 11, 26, 16, 22, 12, 18, 24, 13];
  let bx = gx;
  heights.forEach((bh, i) => {
    const bw = 5 + (i % 3) * 2;
    if (bx >= gx + gw) return;
    const width = Math.min(bw, gx + gw - bx);
    c.rect(bx, gy + gh - bh, width, bh, roof);
    if (sky !== "day") for (let wy = gy + gh - bh + 3; wy < gy + gh - 2; wy += 4) for (let wx = bx + 1; wx < bx + width - 1; wx += 3) if (rand() > 0.55) c.set(wx, wy, rand() > 0.5 ? "amber2" : "amber1");
    bx += width;
  });
  // Blinds
  for (let y = 4; y < 16; y += 2) c.hline(4, y, w - 8, y % 4 === 0 ? "n6" : "n7");
  c.hline(4, 16, w - 8, "n9").vline(w - 9, 16, 9, "cream2").rect(w - 10, 25, 3, 3, "cream2");
  // Mullions
  c.vline(w / 2 - 1, 16, h - 28, "b4").vline(w / 2, 16, h - 28, "b3");
  c.hline(4, 44, w - 8, "b4");
  // Frame highlight and sill
  c.hline(1, 1, w - 2, "b3").vline(1, 1, h - 8, "b3");
  c.rect(-1, h - 7, w + 2, 7, "wood5").hline(0, h - 7, w, "wood4").hline(0, h - 1, w, "wood7");
  return c;
}

export function posterMountain(): PixelCanvas {
  const w = 38;
  const h = 52;
  const c = new PixelCanvas(w, h);
  c.rect(0, 0, w, h, "cream2").frame(0, 0, w, h, "wood7");
  c.rect(3, 3, w - 6, h - 14, "skyA");
  c.dither(3, 14, w - 6, 6, "skyA", "skyB");
  c.rect(3, 20, w - 6, h - 31, "skyB").dither(3, 28, w - 6, 4, "skyB", "skyC");
  c.ellipse(22, 6, 8, 8, "cream").ellipse(25, 5, 8, 8, "skyA");
  for (const [x, y] of [[8, 7], [14, 11], [30, 14], [6, 18]] as const) c.set(x, y, "b2");
  // Mountains
  c.line(3, 36, 14, 18, "p4").line(14, 18, 26, 36, "p4");
  for (let y = 19; y < 36; y++) for (let x = 3; x < 36; x++) if (x - 14 >= -(y - 18) * 0.9 && x - 14 <= (y - 18) * 0.9) c.set(x, y, y < 24 ? "b2" : "n7");
  c.rect(20, 28, 16, 8, "n8");
  for (let y = 29; y < 37; y++) for (let x = 3; x < 35; x++) if (c.get(x, y) === "skyB") c.set(x, y, "n8");
  c.hline(3, 36, w - 6, "n9");
  // Pine trees
  for (const px of [7, 30, 33]) c.rect(px, 31, 1, 5, "n9").rect(px - 1, 33, 3, 2, "leaf9").rect(px, 31, 1, 2, "leaf9");
  // Caption
  c.rect(3, h - 10, w - 6, 7, "n9").text("PIXEL", 7, h - 9, "amber2");
  return c;
}

export function posterSign(): PixelCanvas {
  const w = 38;
  const h = 32;
  const c = new PixelCanvas(w, h);
  c.rect(0, 0, w, h, "n9").frame(0, 0, w, h, "wood6").frame(1, 1, w - 2, h - 2, "wood8");
  c.text("DREAM", 7, 5, "b3").text("BUILD", 7, 13, "cream").text("PLAY", 9, 21, "amber2");
  return c;
}

export function posterSunset(): PixelCanvas {
  const w = 30;
  const h = 38;
  const c = new PixelCanvas(w, h);
  c.rect(0, 0, w, h, "cream2").frame(0, 0, w, h, "wood7");
  c.rect(3, 3, w - 6, h - 6, "p4");
  c.rect(3, 12, w - 6, 8, "rose").rect(3, 18, w - 6, 6, "amber3").dither(3, 17, w - 6, 2, "rose", "amber3");
  c.ellipse(9, 14, 12, 12, "amber1");
  c.rect(3, 24, w - 6, 11, "n7");
  for (let y = 25; y < 34; y += 2) c.hline(8 + (y % 4), y, 11 - (y % 4), "amber2");
  c.hline(3, 24, w - 6, "n9");
  return c;
}

export function posterPlanet(): PixelCanvas {
  const w = 26;
  const h = 32;
  const c = new PixelCanvas(w, h);
  c.rect(0, 0, w, h, "n9").frame(0, 0, w, h, "cream2").frame(1, 1, w - 2, h - 2, "wood7");
  const rand = rng(5);
  for (let i = 0; i < 14; i++) c.set(3 + Math.floor(rand() * (w - 6)), 3 + Math.floor(rand() * (h - 6)), i % 3 === 0 ? "b2" : "b4");
  c.ellipse(7, 10, 12, 12, "lilac").ellipse(9, 12, 6, 6, "p4");
  c.line(3, 18, 22, 11, "amber2").line(3, 19, 22, 12, "amber3");
  c.ellipse(7, 10, 12, 4, null);
  c.ellipse(7, 10, 12, 12, "lilac").ellipse(10, 13, 6, 6, "p4").line(3, 18, 8, 17, "amber2").line(16, 14, 22, 11, "amber2");
  return c;
}

export function pinnedNote(variant: number): PixelCanvas {
  const c = new PixelCanvas(9, 11);
  c.rect(0, 1, 9, 10, variant ? "amber1" : "pink").hline(0, 10, 9, variant ? "amber2" : "rose");
  c.rect(4, 0, 2, 2, "red");
  for (let y = 4; y < 9; y += 2) c.hline(1, y, variant ? 6 : 5, "wood6");
  return c;
}

// ---- furniture -----------------------------------------------------------------------

export function bookshelf(): PixelCanvas {
  const w = 62;
  const h = 92;
  const c = new PixelCanvas(w, h);
  c.rect(0, 0, w, h, "wood8");
  c.rect(0, 0, w, 4, "wood5").hline(0, 0, w, "wood4").hline(0, 3, w, "wood7");
  c.rect(0, 0, 4, h, "wood6").vline(0, 0, h, "wood5").vline(3, 4, h - 4, "wood8");
  c.rect(w - 4, 0, 4, h, "wood6").vline(w - 1, 0, h, "wood8").vline(w - 4, 4, h - 4, "wood7");
  c.rect(4, 4, w - 8, h - 8, "n9");
  const colors = ["red", "b4", "amber3", "leaf5", "lilac", "rose", "cream2", "p4", "wood4", "b3", "leaf7", "amber2"];
  const rand = rng(21);
  const shelfCount = 4;
  const bay = Math.floor((h - 8) / shelfCount);
  for (let s = 0; s < shelfCount; s++) {
    const top = 4 + s * bay;
    const bottom = top + bay - 3;
    c.rect(4, bottom, w - 8, 3, "wood6").hline(4, bottom, w - 8, "wood4").hline(4, bottom + 2, w - 8, "wood8");
    let x = 5;
    while (x < w - 7) {
      const roll = rand();
      if (roll > 0.9) {
        x += 3 + Math.floor(rand() * 4); // gap
        continue;
      }
      const bw = 3 + Math.floor(rand() * 3);
      const bh = 10 + Math.floor(rand() * (bay - 12));
      if (x + bw > w - 5) break;
      const color = colors[Math.floor(rand() * colors.length)]!;
      c.rect(x, bottom - bh, bw, bh, color);
      c.vline(x, bottom - bh, bh, "white").vline(x + bw - 1, bottom - bh, bh, "ink");
      c.hline(x, bottom - bh + 2, bw, "ink").hline(x, bottom - 4, bw, "cream");
      x += bw;
    }
    if (s === 1) {
      // A little trinket box
      c.rect(w - 17, bottom - 6, 9, 6, "amber4").hline(w - 17, bottom - 6, 9, "amber2").set(w - 13, bottom - 4, "cream");
    }
  }
  c.rect(0, h - 4, w, 4, "wood7").hline(0, h - 4, w, "wood5");
  return c;
}

export function bed(): PixelCanvas {
  const w = 84;
  const h = 48;
  const c = new PixelCanvas(w, h);
  // Headboard (left) and footboard (right)
  bevel(c, 0, 0, 8, h, "wood6", "wood4", "wood8");
  c.rect(1, 2, 6, 3, "wood5");
  bevel(c, w - 6, 22, 6, h - 22, "wood6", "wood4", "wood8");
  // Frame rail and legs
  bevel(c, 8, 34, w - 14, 7, "wood7", "wood5", "wood9");
  c.rect(10, 41, 5, 7, "wood8").rect(w - 16, 41, 5, 7, "wood8");
  // Mattress
  c.rect(8, 22, w - 14, 12, "cream2").hline(8, 22, w - 14, "cream");
  // Pillow
  c.rect(9, 15, 20, 10, "b2").rect(9, 15, 20, 2, "white").rect(9, 23, 20, 2, "b3").vline(28, 16, 8, "b3");
  c.hline(12, 19, 12, "b3");
  // Blanket
  c.rect(26, 20, w - 32, 16, "p5").rect(26, 20, w - 32, 3, "p4");
  c.hline(26, 23, w - 32, "n6");
  for (let x = 30; x < w - 8; x += 8) c.rect(x, 27, 4, 2, "p4").rect(x + 4, 31, 4, 2, "p4");
  c.vline(26, 20, 16, "p4").hline(26, 35, w - 32, "n6");
  c.rect(w - 14, 20, 8, 2, "lilac");
  return c;
}

export function nightstand(): PixelCanvas {
  const w = 24;
  const h = 28;
  const c = new PixelCanvas(w, h);
  bevel(c, 0, 0, w, 4, "wood5", "wood4", "wood7");
  bevel(c, 1, 4, w - 2, h - 4, "wood6", "wood5", "wood8");
  bevel(c, 3, 7, w - 6, 8, "wood7", "wood5", "wood9");
  bevel(c, 3, 17, w - 6, 8, "wood7", "wood5", "wood9");
  c.rect(w / 2 - 2, 10, 4, 2, "amber2").rect(w / 2 - 2, 20, 4, 2, "amber2");
  c.rect(1, h - 2, 3, 2, "wood9").rect(w - 4, h - 2, 3, 2, "wood9");
  return c;
}

export function desk(): PixelCanvas {
  const w = 118;
  const h = 50;
  const c = new PixelCanvas(w, h);
  // Top slab
  c.rect(0, 0, w, 6, "wood5").hline(0, 0, w, "wood4").hline(0, 5, w, "wood7");
  c.rect(0, 6, w, 5, "wood6").hline(0, 10, w, "wood8");
  // Left leg
  bevel(c, 3, 11, 7, h - 11, "wood6", "wood5", "wood8");
  // Drawer unit
  bevel(c, 80, 11, 34, h - 11, "wood6", "wood5", "wood8");
  bevel(c, 83, 14, 28, 13, "wood7", "wood5", "wood9");
  bevel(c, 83, 29, 28, 13, "wood7", "wood5", "wood9");
  c.rect(94, 19, 6, 2, "amber2").rect(94, 34, 6, 2, "amber2");
  // Shadow under the desk
  c.rect(11, 11, 69, 3, "wood9");
  c.rect(11, 14, 69, h - 14, "n9").dither(11, 14, 69, 2, "wood9", "n9");
  return c;
}

export function chair(): PixelCanvas {
  const w = 28;
  const h = 40;
  const c = new PixelCanvas(w, h);
  bevel(c, 3, 0, 22, 17, "wood6", "wood4", "wood8");
  c.rect(6, 3, 16, 11, "b5").hline(6, 3, 16, "b4").hline(6, 13, 16, "p5");
  bevel(c, 0, 17, w, 6, "wood5", "wood4", "wood8");
  c.rect(3, 23, 3, 17, "wood8").rect(w - 6, 23, 3, 17, "wood8").rect(4, 23, 1, 17, "wood6").rect(w - 5, 23, 1, 17, "wood6");
  return c;
}

export function crt(cursorOn: boolean): PixelCanvas {
  const w = 46;
  const h = 44;
  const c = new PixelCanvas(w, h);
  // Casing
  bevel(c, 0, 0, w, 36, "cream2", "cream", "steelD");
  c.hline(1, 1, w - 2, "white");
  // Screen bezel and glass
  c.rect(4, 4, w - 8, 26, "steelD").rect(5, 5, w - 10, 24, "screen");
  for (const [x, y] of [[5, 5], [w - 6, 5], [5, 28], [w - 6, 28]] as const) c.set(x, y, "steelD");
  // Prompt
  c.text(">", 8, 10, "screenText");
  if (cursorOn) c.rect(13, 14, 4, 1, "screenText");
  c.text("HELLO", 8, 19, "b3");
  // Glare
  c.hline(7, 6, 8, "b4").hline(7, 7, 3, "b4");
  // Controls
  c.rect(w - 16, 31, 8, 2, "steelD").set(w - 5, 32, "ledG").set(w - 4, 32, "ledG");
  c.rect(4, 31, 12, 2, "steel");
  // Neck and base
  c.rect(15, 36, 16, 4, "steel").hline(15, 36, 16, "steelD");
  bevel(c, 8, 40, 30, 4, "cream2", "cream", "steelD");
  return c;
}

export function tower(): PixelCanvas {
  const w = 16;
  const h = 30;
  const c = new PixelCanvas(w, h);
  bevel(c, 0, 0, w, h, "cream2", "cream", "steelD");
  c.rect(3, 4, 10, 3, "steelD").hline(3, 5, 10, "ink");
  c.rect(3, 9, 10, 3, "steelD").hline(3, 10, 10, "ink");
  c.rect(3, 15, 10, 1, "steel");
  c.rect(11, 20, 2, 2, "ledG").set(4, 21, "ledR").set(6, 21, "ledG");
  for (let x = 3; x < 13; x += 2) c.vline(x, 24, 4, "steelD");
  return c;
}

export function keyboard(): PixelCanvas {
  const w = 32;
  const h = 6;
  const c = new PixelCanvas(w, h);
  bevel(c, 0, 0, w, h, "cream2", "cream", "steelD");
  for (let x = 2; x < w - 2; x += 2) c.set(x, 2, "steelD").set(x, 4, "steelD");
  c.hline(6, 3, w - 12, "cream");
  return c;
}

export function mug(): PixelCanvas {
  return fromGrid(
    ["..wwww..", ".wcccc..", ".wccccww", ".wccccwc", ".wccccww", ".wccccw.", "..wwww..", "........"],
    { w: "white", c: "cream" },
  ).stamp(new PixelCanvas(8, 3).rect(1, 0, 6, 1, "wood7"), 0, 1);
}

export function lamp(): PixelCanvas {
  const w = 24;
  const h = 42;
  const c = new PixelCanvas(w, h);
  // Base and arms
  c.ellipse(2, h - 5, 14, 5, "steelD").ellipse(3, h - 6, 12, 4, "steel");
  c.line(9, h - 6, 11, 16, "steelD").line(10, h - 6, 12, 16, "steel");
  c.line(11, 16, 17, 10, "steelD").line(11, 17, 17, 11, "steel");
  // Head
  c.rect(14, 4, 9, 8, "amber3").rect(14, 4, 9, 2, "amber2").hline(14, 11, 9, "amber4");
  c.rect(15, 12, 7, 2, "amber1").rect(16, 14, 5, 1, "amber2");
  c.set(13, 5, "amber4").set(13, 6, "amber4");
  return c;
}

export function mugSteam(frame: number): PixelCanvas {
  const c = new PixelCanvas(6, 8);
  const x = frame % 2 === 0 ? 2 : 3;
  c.set(x, 7, "white").set(x + 1, 5, "cream").set(x, 3, "white").set(x + 1, 1, "cream");
  return c;
}

// ---- plants ------------------------------------------------------------------------------

export function plantBig(): PixelCanvas {
  const w = 26;
  const h = 40;
  const c = new PixelCanvas(w, h);
  // Fronds
  for (const [a, len, x] of [[-110, 17, 12], [-95, 20, 13], [-80, 19, 14], [-65, 17, 15], [-130, 13, 11], [-50, 14, 16], [-150, 9, 10], [-30, 10, 17]] as const) leaf(c, x, 24, a, len, 3.2, "leaf5", "leaf3");
  for (const [a, len, x] of [[-100, 12, 12], [-75, 13, 14]] as const) leaf(c, x, 24, a, len, 2.2, "leaf7", "leaf5");
  // Pot
  bevel(c, 4, 24, 18, 4, "pot", "amber3", "potD");
  c.rect(5, 28, 16, 11, "pot").rect(5, 28, 3, 11, "amber3").rect(18, 28, 3, 11, "potD").hline(5, 38, 16, "potD");
  c.rect(6, 24, 14, 2, "wood9");
  return c;
}

export function plantMid(): PixelCanvas {
  const w = 20;
  const h = 26;
  const c = new PixelCanvas(w, h);
  for (const [a, len, x] of [[-105, 12, 9], [-85, 14, 10], [-65, 11, 11], [-125, 9, 8], [-45, 8, 12]] as const) leaf(c, x, 15, a, len, 2.8, "leaf5", "leaf3");
  bevel(c, 3, 15, 14, 3, "pot", "amber3", "potD");
  c.rect(4, 18, 12, 8, "pot").rect(4, 18, 2, 8, "amber3").rect(14, 18, 2, 8, "potD").hline(4, 25, 12, "potD");
  return c;
}

export function plantSmall(): PixelCanvas {
  const w = 14;
  const h = 18;
  const c = new PixelCanvas(w, h);
  for (const [a, len, x] of [[-100, 8, 6], [-70, 8, 7], [-130, 6, 5], [-45, 6, 8]] as const) leaf(c, x, 10, a, len, 2.2, "leaf5", "leaf3");
  c.rect(2, 10, 10, 8, "pot").rect(2, 10, 10, 2, "amber3").rect(10, 12, 2, 6, "potD").hline(2, 17, 10, "potD");
  return c;
}

export function vines(): PixelCanvas {
  const w = 26;
  const h = 34;
  const c = new PixelCanvas(w, h);
  // A small pot with a few strands trailing down the front of the shelf.
  c.rect(5, 0, 14, 8, "pot").rect(5, 0, 14, 2, "amber3").rect(17, 2, 2, 6, "potD");
  for (const [a, x] of [[-125, 8], [-90, 12], [-55, 16]] as const) leaf(c, x, 3, a, 5, 1.8, "leaf5", "leaf3");
  for (const [x, len] of [[7, 22], [13, 28], [19, 16]] as const) {
    for (let y = 8; y < 8 + len; y++) c.set(x + Math.round(Math.sin(y / 3) * 1.2), y, "leaf7");
    for (let y = 13; y < 8 + len; y += 6) leaf(c, x + Math.round(Math.sin(y / 3) * 1.2), y, y % 12 === 1 ? 25 : 155, 3, 1.2, "leaf5", "leaf3");
  }
  return c;
}

// ---- cats -----------------------------------------------------------------------------------

export type CatFur = "grey" | "orange" | "dark";
const FUR: Record<CatFur, [string, string, string]> = { grey: ["catG", "catGD", "catL"], orange: ["catO", "catOD", "catL"], dark: ["catB", "ink", "catG"] };

export function catSleeping(fur: CatFur, frame = 0): PixelCanvas {
  const [base, dark, light] = FUR[fur];
  const w = 20;
  const h = 11;
  const c = new PixelCanvas(w, h);
  const lift = frame % 2;
  c.ellipse(1, 2 - lift, 15, 9 + lift, base);
  c.ellipse(2, 7, 13, 3, dark);
  for (let x = 5; x < 14; x += 3) c.vline(x, 3 - lift, 3, dark);
  // Head tucked in on the left
  c.ellipse(0, 3, 8, 7, base).rect(1, 2, 2, 2, base).rect(5, 2, 2, 2, base);
  c.set(1, 1, dark).set(6, 1, dark).set(1, 2, light).set(6, 2, light);
  c.hline(2, 5, 2, "ink").hline(5, 5, 2, "ink");
  // Tail curling around
  c.line(15, 7, 19, 5, base).line(15, 8, 19, 6, base).set(19, 4, light).set(19, 5, light);
  return c;
}

export function catSitting(fur: CatFur, frame = 0): PixelCanvas {
  const [base, dark, light] = FUR[fur];
  const w = 14;
  const h = 16;
  const c = new PixelCanvas(w, h);
  c.ellipse(2, 7, 9, 9, base);
  c.rect(3, 12, 3, 4, dark).rect(7, 12, 3, 4, dark);
  c.ellipse(3, 1, 8, 7, base);
  c.rect(3, 0, 2, 2, base).rect(8, 0, 2, 2, base).set(4, 1, light).set(8, 1, light);
  c.set(5, 4, "ink").set(8, 4, "ink").set(6, 5, "rose").set(7, 5, "rose");
  c.line(11, 13, 13, 8 + (frame % 2), base).line(11, 14, 13, 9 + (frame % 2), dark);
  return c;
}

export function cushion(): PixelCanvas {
  const c = new PixelCanvas(34, 14);
  c.ellipse(0, 0, 34, 14, "p5").ellipse(2, 1, 30, 11, "b5").ellipse(5, 3, 24, 7, "b4");
  c.dither(6, 5, 22, 3, "b4", "b3");
  return c;
}

// ---- the character ------------------------------------------------------------------------------

function head(c: PixelCanvas, x: number, y: number, blink: boolean) {
  c.rect(x + 1, y, 10, 3, "hair").rect(x, y + 1, 12, 5, "hair").rect(x + 2, y, 3, 1, "hairL").set(x + 6, y, "hairL");
  c.rect(x + 1, y + 4, 10, 6, "skin").rect(x + 1, y + 9, 10, 1, "skinD");
  c.rect(x, y + 3, 2, 4, "hair").rect(x + 10, y + 3, 2, 4, "hair");
  c.hline(x + 2, y + 3, 3, "hair").hline(x + 7, y + 3, 3, "hair").set(x + 5, y + 3, "hair");
  if (blink) c.hline(x + 3, y + 6, 2, "hair").hline(x + 7, y + 6, 2, "hair");
  else c.rect(x + 3, y + 5, 2, 2, "ink").rect(x + 7, y + 5, 2, 2, "ink").set(x + 3, y + 5, "white").set(x + 7, y + 5, "white");
  c.set(x + 2, y + 8, "pink").set(x + 9, y + 8, "pink").hline(x + 5, y + 9, 2, "skinD");
}

export function character(frame: number): PixelCanvas {
  const w = 26;
  const h = 30;
  const c = new PixelCanvas(w, h);
  const bob = frame % 2;
  // Crossed legs
  c.ellipse(1, 22, 24, 8, "n6").ellipse(3, 23, 20, 6, "n7");
  c.rect(2, 26, 7, 3, "wood8").rect(17, 26, 7, 3, "wood8").hline(3, 26, 5, "wood6").hline(18, 26, 5, "wood6");
  // Body
  c.rect(5, 12 + bob, 16, 12 - bob, "hood").rect(5, 12 + bob, 3, 12 - bob, "hoodD").rect(18, 12 + bob, 3, 12 - bob, "hoodD");
  c.rect(10, 12 + bob, 6, 4, "hoodD").vline(12, 15 + bob, 5, "cream2").vline(14, 15 + bob, 5, "cream2");
  c.rect(8, 19 + bob, 10, 4, "hoodD").hline(8, 19 + bob, 10, "hood");
  // Arms and hands holding a handheld
  c.rect(3, 16 + bob, 4, 7, "hood").rect(19, 16 + bob, 4, 7, "hood").rect(4, 22, 3, 2, "skin").rect(19, 22, 3, 2, "skin");
  c.rect(9, 21 + bob, 8, 4, "steelD").rect(10, 22 + bob, 6, 2, "leaf3");
  head(c, 7, bob, frame === 2);
  return c;
}

export function portrait(blink: boolean): PixelCanvas {
  const small = new PixelCanvas(14, 14);
  head(small, 1, 1, blink);
  small.rect(0, 11, 14, 3, "hood").rect(0, 11, 3, 3, "hoodD").rect(11, 11, 3, 3, "hoodD").rect(5, 11, 4, 2, "hoodD");
  const out = new PixelCanvas(28, 28);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
    const k = small.get(x, y);
    if (k !== null) out.rect(x * 2, y * 2, 2, 2, k);
  }
  return out;
}

// ---- small objects ---------------------------------------------------------------------------------

export function notebook(): PixelCanvas {
  const w = 20;
  const h = 14;
  const c = new PixelCanvas(w, h);
  // Cover (top face in slight perspective) and page edge
  c.rect(1, 1, 17, 9, "amber4").rect(1, 1, 17, 1, "amber3").rect(1, 1, 1, 9, "amber3");
  c.rect(0, 10, 18, 3, "cream2").hline(1, 11, 16, "cream").hline(0, 12, 18, "steel");
  c.rect(18, 2, 2, 11, "wood7");
  c.rect(10, 3, 5, 5, "amber2").set(12, 5, "amber4").set(11, 4, "amber4").set(13, 6, "amber4");
  c.rect(3, 1, 1, 9, "rose");
  return c;
}

export function handheld(): PixelCanvas {
  const w = 12;
  const h = 16;
  const c = new PixelCanvas(w, h);
  bevel(c, 0, 0, w, h, "lilac", "b2", "p5");
  c.rect(2, 2, 8, 6, "ink").rect(3, 3, 6, 4, "leaf3").set(4, 4, "leaf9").set(5, 5, "leaf9").set(7, 4, "leaf9");
  c.rect(2, 11, 1, 3, "n9").rect(1, 12, 3, 1, "n9");
  c.set(8, 12, "red").set(10, 11, "rose");
  return c;
}

export function recordPlayer(): PixelCanvas {
  const w = 42;
  const h = 46;
  const c = new PixelCanvas(w, h);
  // Cabinet
  bevel(c, 0, 16, w, h - 16, "wood6", "wood5", "wood8");
  c.rect(3, 22, w - 6, 20, "n9");
  c.vline(w / 2, 22, 20, "wood7");
  const rand = rng(31);
  for (const [x0, x1] of [[4, w / 2 - 1], [w / 2 + 2, w - 5]] as const) {
    for (let x = x0; x < x1; x += 2) {
      const hgt = 11 + Math.floor(rand() * 7);
      c.rect(x, 42 - hgt, 2, hgt, ["rose", "b4", "amber3", "lilac", "cream2"][Math.floor(rand() * 5)]!);
    }
  }
  c.rect(0, h - 3, 4, 3, "wood9").rect(w - 4, h - 3, 4, 3, "wood9");
  // Turntable
  bevel(c, 2, 8, w - 4, 8, "wood7", "wood5", "wood9");
  c.ellipse(5, 2, 24, 10, "ink").ellipse(8, 4, 18, 6, "n9").ellipse(13, 5, 8, 4, "amber2").set(17, 6, "ink");
  c.hline(10, 4, 5, "n7").hline(18, 8, 4, "n7");
  c.line(33, 4, 25, 7, "steel").rect(32, 2, 4, 3, "steelD");
  return c;
}

export function alarmClock(time: string): PixelCanvas {
  const w = 24;
  const h = 12;
  const c = new PixelCanvas(w, h);
  bevel(c, 0, 0, w, h, "wood6", "wood5", "wood8");
  c.rect(2, 2, w - 4, h - 5, "screen");
  c.text(time.replace(":", " "), 3, 3, "amber2");
  c.set(w / 2 - 1, 4, "amber2").set(w / 2 - 1, 6, "amber2");
  c.rect(2, h - 1, 2, 1, "wood9").rect(w - 4, h - 1, 2, 1, "wood9");
  return c;
}

export function sparkle(): PixelCanvas {
  const c = new PixelCanvas(7, 7);
  c.vline(3, 0, 7, "cream").hline(0, 3, 7, "cream").rect(2, 2, 3, 3, "white");
  return c;
}

export function heart(): PixelCanvas {
  return fromGrid([".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."], { r: "rose" });
}

export function musicNote(): PixelCanvas {
  return fromGrid(["..ttt.", "..t.tt", "..t...", "..t...", ".tt...", ".tt..."], { t: "b3" });
}

// ---- interface icons (drawn in "ink"; they sit on light buttons) ------------------------------

export function iconHome(): PixelCanvas {
  return fromGrid(
    [".....kk.....", "....kkkk....", "...kkkkkk...", "..kkkkkkkk..", ".kkkkkkkkkk.", "kkkkkkkkkkkk", "..kkkkkkkk..", "..kkk..kkk..", "..kkk..kkk..", "..kkk..kkk..", "..kkk..kkk.."],
    { k: "ink" },
  );
}

export function iconSound(on: boolean): PixelCanvas {
  const c = fromGrid(["....k.......", "...kk.......", "kkkkk.......", "kkkkk.......", "kkkkk.......", "kkkkk.......", "kkkkk.......", "...kk.......", "....k......."], { k: "ink" });
  if (on) {
    c.set(7, 3, "ink").set(8, 4, "ink").set(8, 5, "ink").set(8, 6, "ink").set(7, 7, "ink");
    c.set(9, 1, "ink").set(10, 2, "ink").set(10, 3, "ink").set(10, 4, "ink").set(10, 5, "ink").set(10, 6, "ink").set(10, 7, "ink").set(10, 8, "ink").set(9, 9, "ink");
  } else {
    c.set(7, 3, "ink").set(8, 4, "ink").set(9, 5, "ink").set(10, 6, "ink").set(10, 3, "ink").set(9, 4, "ink").set(8, 5, "ink").set(7, 6, "ink");
  }
  return c;
}

export function iconGear(): PixelCanvas {
  const c = new PixelCanvas(13, 13);
  c.ellipse(2, 2, 9, 9, "ink");
  for (const [x, y] of [[5, 0], [5, 11], [0, 5], [11, 5], [1, 1], [10, 1], [1, 10], [10, 10]] as const) c.rect(x, y, 3, 2, "ink").rect(x, y, 2, 3, "ink");
  c.ellipse(4, 4, 5, 5, null);
  return c;
}

export function iconArrow(): PixelCanvas {
  return fromGrid(["k....", "kk...", "kkk..", "kkkk.", "kkk..", "kk...", "k...."], { k: "ink" });
}

/** Light version of the arrow for dark dialogue panels. */
export function dialogueArrow(): PixelCanvas {
  return fromGrid(["b.....", "bb....", "bbb...", "bbbb..", "bbb...", "bb....", "b....."], { b: "b3" });
}

/** Pixel mouse cursors: an arrow, and a pointing hand over things you can click. */
export function cursorArrow(): PixelCanvas {
  return fromGrid(
    ["k.........", "kk........", "kwk.......", "kwwk......", "kwwwk.....", "kwwwwk....", "kwwwwwk...", "kwwwwwwk..", "kwwwwwwwk.", "kwwwwkkkkk", "kwwkwk....", "kwk.kwk...", "kk..kwk...", "k....kk..."],
    { k: "ink", w: "white" },
  );
}

export function cursorHand(): PixelCanvas {
  return fromGrid(
    ["....kk......", "...kwwk.....", "...kwwk.....", "...kwwk.....", "...kwwkkk...", "...kwwkwwkk.", ".kkkwwkwwkwk", "kwwkwwwwwwwk", "kwwwwwwwwwwk", ".kwwwwwwwwwk", "..kwwwwwwwk.", "..kwwwwwwwk.", "...kwwwwwk..", "...kkkkkkk.."],
    { k: "ink", w: "white" },
  );
}

/** The four-pointed star logo glyph used on the title screen. */
export function logoStar(): PixelCanvas {
  const c = new PixelCanvas(13, 13);
  c.vline(6, 0, 13, "lilac").hline(0, 6, 13, "lilac");
  c.rect(5, 4, 3, 5, "b2").rect(4, 5, 5, 3, "b2").rect(6, 2, 1, 9, "white").rect(2, 6, 9, 1, "white");
  return c;
}
