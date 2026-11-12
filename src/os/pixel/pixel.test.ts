import { describe, expect, it } from "vitest";
import { PixelCanvas, FONT, fromGrid } from "./canvas";
import { HOODIES, ROOM_THEMES, buildPalette, findHoodie, findTheme } from "./palette";
import { SPRITE_IDS, buildSprite, spriteSize, spriteUrl, type SpriteId } from "./registry";

const VARIANTS: Partial<Record<SpriteId, string[]>> = {
  window: ["night", "dusk", "day"],
  crt: ["on", "off"],
  steam: ["0", "1"],
  catBed: ["0", "1"],
  catCushion: ["0", "1"],
  catShelf: ["0", "1"],
  character: ["0", "1", "2"],
  portrait: ["open", "blink"],
  alarmClock: ["10:42", "00:00", "23:59"],
};

describe("PixelCanvas", () => {
  it("sets, reads and clips pixels", () => {
    const c = new PixelCanvas(4, 4);
    c.set(1, 1, "a").set(-1, 0, "b").set(9, 9, "c");
    expect(c.get(1, 1)).toBe("a");
    expect(c.get(-1, 0)).toBeNull();
    expect(c.cells.filter(Boolean)).toHaveLength(1);
  });

  it("draws rectangles, frames and lines", () => {
    const c = new PixelCanvas(6, 6).rect(1, 1, 3, 2, "r").frame(0, 3, 5, 3, "f").line(0, 0, 5, 0, "l");
    expect(c.cells.filter((k) => k === "r")).toHaveLength(6);
    expect(c.get(0, 0)).toBe("l");
    expect(c.get(5, 0)).toBe("l");
    expect(c.get(2, 4)).toBeNull(); // interior of a frame stays empty
  });

  it("stamps with transparency and optional flipping", () => {
    const src = fromGrid(["a.", ".b"], { a: "A", b: "B" });
    const dst = new PixelCanvas(3, 3).rect(0, 0, 3, 3, "bg").stamp(src, 0, 0);
    expect(dst.get(0, 0)).toBe("A");
    expect(dst.get(1, 0)).toBe("bg");
    const flipped = new PixelCanvas(2, 2).stamp(src, 0, 0, { flipX: true });
    expect(flipped.get(1, 0)).toBe("A");
    expect(flipped.get(0, 1)).toBe("B");
  });

  it("outlines with a ring exactly one pixel thick", () => {
    const o = new PixelCanvas(1, 1).set(0, 0, "x").outlined("o");
    expect(o.width).toBe(3);
    expect(o.get(1, 1)).toBe("x");
    expect(o.get(0, 1)).toBe("o");
    expect(o.get(1, 0)).toBe("o");
    expect(o.get(0, 0)).toBeNull(); // diagonals are not outlined
  });

  it("draws text with the 3x5 font", () => {
    const c = new PixelCanvas(20, 7);
    c.text("HI", 1, 1, "t");
    expect(PixelCanvas.textWidth("HI")).toBe(7);
    expect(PixelCanvas.textWidth("")).toBe(0);
    expect(c.cells.filter((k) => k === "t").length).toBeGreaterThan(8);
  });

  it("has a glyph for every character used in the game's text", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.,!?-'>< _/+") expect(FONT[ch], ch).toBeDefined();
    for (const glyph of Object.values(FONT)) {
      expect(glyph).toHaveLength(5);
      for (const row of glyph) expect(row).toMatch(/^[01]{3}$/);
    }
  });

  it("fromGrid rejects unknown legend characters", () => {
    expect(() => fromGrid(["z"], {})).toThrow(/no legend entry/);
  });

  it("serialises to compact, valid SVG with one path per colour", () => {
    const c = new PixelCanvas(4, 2).rect(0, 0, 4, 2, "a").set(1, 1, "b");
    const svg = c.toSvg({ a: "#111111", b: "#222222" });
    expect(svg).toContain('viewBox="0 0 4 2"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect((svg.match(/<path/g) ?? []).length).toBe(2);
    expect(svg).not.toContain("#ff00ff");
  });

  it("flags missing palette entries in a visible colour", () => {
    expect(new PixelCanvas(1, 1).set(0, 0, "nope").toSvg({})).toContain("#ff00ff");
  });
});

describe("palette and themes", () => {
  it("has unique theme ids and complete ramps", () => {
    expect(new Set(ROOM_THEMES.map((t) => t.id)).size).toBe(ROOM_THEMES.length);
    for (const t of ROOM_THEMES) for (const v of Object.values(t.ramp)) expect(v, t.id).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("falls back to defaults for unknown ids", () => {
    expect(findTheme("nope").id).toBe("midnight");
    expect(findHoodie("nope").id).toBe("blue");
  });

  it("keeps the colour budget small", () => {
    const keys = Object.keys(buildPalette("midnight", "blue"));
    expect(keys.length).toBeLessThan(80);
  });
});

describe("sprites", () => {
  const combos: [SpriteId, string][] = SPRITE_IDS.flatMap((id) => (VARIANTS[id] ?? [""]).map((v): [SpriteId, string] => [id, v]));

  it("every sprite builds and uses only palette keys that exist in every theme and hoodie", () => {
    for (const theme of ROOM_THEMES) {
      for (const hoodie of HOODIES) {
        const palette = buildPalette(theme.id, hoodie.id);
        for (const [id, variant] of combos) {
          const used = new Set(buildSprite(id, variant).cells.filter((k): k is string => k !== null));
          for (const key of used) expect(palette[key], `${id}/${variant} uses unknown colour "${key}" in ${theme.id}`).toBeDefined();
        }
      }
    }
  });

  it("every sprite actually contains pixels and stays within a sensible size", () => {
    for (const [id, variant] of combos) {
      const { width, height } = spriteSize(id, variant);
      expect(buildSprite(id, variant).cells.some((k) => k !== null), id).toBe(true);
      expect(width, id).toBeGreaterThan(3);
      expect(width, id).toBeLessThanOrEqual(320);
      expect(height, id).toBeLessThanOrEqual(180);
    }
  });

  it("animation frames of one sprite share a size, so swapping frames never shifts layout", () => {
    for (const id of ["catBed", "catCushion", "catShelf", "character", "crt"] as const) {
      const sizes = new Set((VARIANTS[id] ?? [""]).map((v) => JSON.stringify(spriteSize(id, v))));
      expect(sizes.size, id).toBe(1);
    }
  });

  it("caches rendered images per theme", () => {
    const p = buildPalette("midnight", "blue");
    expect(spriteUrl("bed", "", p, "midnight|blue")).toBe(spriteUrl("bed", "", p, "midnight|blue"));
    expect(spriteUrl("bed", "", buildPalette("dusk", "blue"), "dusk|blue")).not.toBe(spriteUrl("bed", "", p, "midnight|blue"));
    expect(spriteUrl("bed", "", p, "midnight|blue")).toMatch(/^data:image\/svg\+xml/);
  });
});
