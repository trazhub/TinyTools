/**
 * A tiny pixel-art toolkit. Sprites are built in code on a PixelCanvas using
 * *palette keys* (not colours), so the same artwork can be recoloured by theme.
 * `toSvg` turns a canvas into crisp, scalable SVG: one path per colour.
 */

export type Palette = Readonly<Record<string, string>>;

export class PixelCanvas {
  readonly cells: (string | null)[];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = new Array<string | null>(width * height).fill(null);
  }

  get(x: number, y: number): string | null {
    return x < 0 || y < 0 || x >= this.width || y >= this.height ? null : (this.cells[y * this.width + x] ?? null);
  }

  set(x: number, y: number, key: string | null): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.cells[y * this.width + x] = key;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, key: string | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, key);
    return this;
  }

  /** Outline-only rectangle. */
  frame(x: number, y: number, w: number, h: number, key: string): this {
    return this.rect(x, y, w, 1, key).rect(x, y + h - 1, w, 1, key).rect(x, y, 1, h, key).rect(x + w - 1, y, 1, h, key);
  }

  hline(x: number, y: number, w: number, key: string | null) {
    return this.rect(x, y, w, 1, key);
  }

  vline(x: number, y: number, h: number, key: string | null) {
    return this.rect(x, y, 1, h, key);
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, key: string | null): this {
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, key);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Filled ellipse inscribed in the box (x, y, w, h). */
  ellipse(x: number, y: number, w: number, h: number, key: string | null): this {
    const rx = w / 2;
    const ry = h / 2;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const nx = (i + 0.5 - rx) / rx;
        const ny = (j + 0.5 - ry) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x + i, y + j, key);
      }
    }
    return this;
  }

  /** Checkerboard dither between two keys (either may be null to leave the cell alone). */
  dither(x: number, y: number, w: number, h: number, a: string | null, b: string | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, (i + j) % 2 === 0 ? a : b);
    return this;
  }

  /** Copy another canvas on top of this one; null cells are transparent. */
  stamp(src: PixelCanvas, x: number, y: number, options: { flipX?: boolean } = {}): this {
    for (let j = 0; j < src.height; j++) {
      for (let i = 0; i < src.width; i++) {
        const key = src.get(options.flipX ? src.width - 1 - i : i, j);
        if (key !== null) this.set(x + i, y + j, key);
      }
    }
    return this;
  }

  /** Draw text with the built-in 3x5 font (uppercase). Use `PixelCanvas.textWidth` to measure it. */
  text(str: string, x: number, y: number, key: string, spacing = 1): this {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const glyph = FONT[ch] ?? FONT["?"]!;
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (glyph[j]![i] === "1") this.set(cx + i, y + j, key);
      cx += 3 + spacing;
    }
    return this;
  }

  /** Width in pixels that `text(str)` will occupy. */
  static textWidth(str: string, spacing = 1): number {
    return str.length === 0 ? 0 : str.length * (3 + spacing) - spacing;
  }

  /** Recolour every cell using a key -> key map. */
  remap(map: Record<string, string>): PixelCanvas {
    const out = new PixelCanvas(this.width, this.height);
    for (let i = 0; i < this.cells.length; i++) {
      const k = this.cells[i];
      out.cells[i] = k === null || k === undefined ? null : (map[k] ?? k);
    }
    return out;
  }

  /** Add a 1px outline (in `key`) around all opaque cells. */
  outlined(key: string): PixelCanvas {
    const padded = new PixelCanvas(this.width + 2, this.height + 2).stamp(this, 1, 1);
    const out = new PixelCanvas(padded.width, padded.height).stamp(padded, 0, 0);
    for (let y = 0; y < padded.height; y++) {
      for (let x = 0; x < padded.width; x++) {
        if (padded.get(x, y) !== null) continue;
        // Look only at the untouched copy so the ring stays exactly one pixel thick.
        const touching = [padded.get(x - 1, y), padded.get(x + 1, y), padded.get(x, y - 1), padded.get(x, y + 1)].some((k) => k !== null);
        if (touching) out.set(x, y, key);
      }
    }
    return out;
  }

  /**
   * Render as an SVG string. Colours are grouped into one path each, and
   * `shape-rendering="crispEdges"` keeps edges sharp at any integer scale.
   */
  toSvg(palette: Palette, scale = 1): string {
    const byColor = new Map<string, string[]>();
    for (let y = 0; y < this.height; y++) {
      let x = 0;
      while (x < this.width) {
        const key = this.cells[y * this.width + x];
        if (key === null || key === undefined) {
          x++;
          continue;
        }
        let run = 1;
        while (x + run < this.width && this.cells[y * this.width + x + run] === key) run++;
        const color = palette[key] ?? "#ff00ff"; // magenta = missing palette entry, obvious in review
        const list = byColor.get(color) ?? [];
        list.push(`M${x} ${y}h${run}v1h-${run}z`);
        byColor.set(color, list);
        x += run;
      }
    }
    const paths = [...byColor].map(([color, d]) => `<path fill="${color}" d="${d.join("")}"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}" width="${this.width * scale}" height="${this.height * scale}" shape-rendering="crispEdges">${paths}</svg>`;
  }

  toDataUrl(palette: Palette, scale = 1): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(this.toSvg(palette, scale))}`;
  }
}

/**
 * Build a canvas from rows of characters. `legend` maps a character to a palette
 * key; "." and space are transparent.
 */
export function fromGrid(rows: readonly string[], legend: Readonly<Record<string, string>>): PixelCanvas {
  const width = Math.max(...rows.map((r) => r.length));
  const c = new PixelCanvas(width, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === "." || ch === " ") continue;
      const key = legend[ch];
      if (key === undefined) throw new Error(`fromGrid: no legend entry for "${ch}" (row ${y}, col ${x})`);
      c.set(x, y, key);
    }
  });
  return c;
}

// 3x5 bitmap font, one string of 15 bits per glyph (row-major).
const g = (s: string): string[] => [s.slice(0, 3), s.slice(3, 6), s.slice(6, 9), s.slice(9, 12), s.slice(12, 15)];
export const FONT: Record<string, string[]> = {
  " ": g("000000000000000"),
  A: g("111101111101101"),
  B: g("110101110101110"),
  C: g("111100100100111"),
  D: g("110101101101110"),
  E: g("111100110100111"),
  F: g("111100110100100"),
  G: g("111100101101111"),
  H: g("101101111101101"),
  I: g("111010010010111"),
  J: g("001001001101111"),
  K: g("101101110101101"),
  L: g("100100100100111"),
  M: g("101111111101101"),
  N: g("110101101101101"),
  O: g("111101101101111"),
  P: g("111101111100100"),
  Q: g("111101101111001"),
  R: g("111101110101101"),
  S: g("111100111001111"),
  T: g("111010010010010"),
  U: g("101101101101111"),
  V: g("101101101101010"),
  W: g("101101111111101"),
  X: g("101101010101101"),
  Y: g("101101010010010"),
  Z: g("111001010100111"),
  "0": g("111101101101111"),
  "1": g("010110010010111"),
  "2": g("111001111100111"),
  "3": g("111001111001111"),
  "4": g("101101111001001"),
  "5": g("111100111001111"),
  "6": g("111100111101111"),
  "7": g("111001001001001"),
  "8": g("111101111101111"),
  "9": g("111101111001111"),
  ":": g("000010000010000"),
  ".": g("000000000000010"),
  ",": g("000000000010100"),
  "!": g("010010010000010"),
  "?": g("111001011000010"),
  "-": g("000000111000000"),
  "'": g("010010000000000"),
  ">": g("100010001010100"),
  "<": g("001010100010001"),
  _: g("000000000000111"),
  "/": g("001001010100100"),
  "+": g("000010111010000"),
};
