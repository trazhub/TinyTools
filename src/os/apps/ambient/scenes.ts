import { rng } from "../../pixel/sprites";

export const SCENE_W = 160;
export const SCENE_H = 90;

export type SceneKind = "city" | "rain" | "snow" | "fireflies";

export interface SceneInfo {
  id: SceneKind;
  name: string;
  blurb: string;
  /** Ambient sound that goes with the scene (generated, not downloaded). */
  sound: "rain" | "wind" | "crickets" | null;
}

export const SCENES: readonly SceneInfo[] = [
  { id: "city", name: "Night city", blurb: "Quiet rooftops, a crescent moon and the odd shooting star.", sound: null },
  { id: "rain", name: "Rain", blurb: "Steady rain on the window, with distant lightning.", sound: "rain" },
  { id: "snow", name: "Snow", blurb: "Soft snowfall over a sleeping forest.", sound: "wind" },
  { id: "fireflies", name: "Fireflies", blurb: "A warm summer night full of tiny lights.", sound: "crickets" },
];

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export interface SceneState {
  kind: SceneKind;
  particles: Particle[];
  /** Seconds since the scene started. */
  t: number;
  /** 0 to 1 lightning brightness, fading out. */
  flash: number;
  /** Seconds until the next lightning or shooting star. */
  nextEvent: number;
  shooting: { x: number; y: number; life: number } | null;
}

export type Random = () => number;

const COUNTS: Record<SceneKind, number> = { city: 0, rain: 110, snow: 70, fireflies: 26 };

export function createScene(kind: SceneKind, rand: Random): SceneState {
  const particles: Particle[] = [];
  for (let i = 0; i < COUNTS[kind]; i++) {
    particles.push({
      x: rand() * SCENE_W,
      y: rand() * SCENE_H,
      vx: kind === "rain" ? -18 : kind === "snow" ? (rand() - 0.5) * 8 : (rand() - 0.5) * 10,
      vy: kind === "rain" ? 90 + rand() * 60 : kind === "snow" ? 8 + rand() * 10 : (rand() - 0.5) * 8,
      phase: rand() * Math.PI * 2,
    });
  }
  return { kind, particles, t: 0, flash: 0, nextEvent: 6 + rand() * 8, shooting: null };
}

/** Advance the simulation by `dt` seconds. Mutates and returns the same state for speed. */
export function stepScene(s: SceneState, dt: number, rand: Random): SceneState {
  dt = Math.min(dt, 0.1); // a long pause (background tab) must not teleport everything
  s.t += dt;
  s.flash = Math.max(0, s.flash - dt * 1.6);

  for (const p of s.particles) {
    p.phase += dt * (s.kind === "fireflies" ? 2.2 : 1.4);
    if (s.kind === "snow") p.vx = Math.sin(p.phase) * 6;
    if (s.kind === "fireflies") {
      // A lazy random walk that stays inside the scene.
      p.vx += (rand() - 0.5) * 30 * dt;
      p.vy += (rand() - 0.5) * 30 * dt;
      p.vx = Math.max(-9, Math.min(9, p.vx));
      p.vy = Math.max(-9, Math.min(9, p.vy));
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (s.kind === "rain" || s.kind === "snow") {
      if (p.y > SCENE_H) {
        p.y = -2;
        p.x = rand() * (SCENE_W + 20);
      }
      if (p.x < -4) p.x += SCENE_W + 8;
      if (p.x > SCENE_W + 4) p.x -= SCENE_W + 8;
    } else if (s.kind === "fireflies") {
      if (p.x < 2 || p.x > SCENE_W - 2) p.vx = -p.vx;
      if (p.y < 8 || p.y > SCENE_H - 6) p.vy = -p.vy;
      p.x = Math.max(2, Math.min(SCENE_W - 2, p.x));
      p.y = Math.max(8, Math.min(SCENE_H - 6, p.y));
    }
  }

  s.nextEvent -= dt;
  if (s.nextEvent <= 0) {
    s.nextEvent = 7 + rand() * 12;
    if (s.kind === "rain") s.flash = 1;
    else if (s.kind === "city" || s.kind === "snow") s.shooting = { x: 20 + rand() * 90, y: 4 + rand() * 18, life: 0.9 };
  }
  if (s.shooting) {
    s.shooting.x += 70 * dt;
    s.shooting.y += 32 * dt;
    s.shooting.life -= dt;
    if (s.shooting.life <= 0) s.shooting = null;
  }
  return s;
}

// ---- drawing ------------------------------------------------------------------

const rect = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

function sky(ctx: CanvasRenderingContext2D, bands: readonly string[]) {
  const h = Math.ceil(SCENE_H / bands.length);
  bands.forEach((c, i) => rect(ctx, c, 0, i * h, SCENE_W, h));
}

function skyline(ctx: CanvasRenderingContext2D, seed: number, t: number, body: string, lit: boolean) {
  const rand = rng(seed);
  let x = 0;
  while (x < SCENE_W) {
    const w = 8 + Math.floor(rand() * 10);
    const h = 18 + Math.floor(rand() * 34);
    rect(ctx, body, x, SCENE_H - h, w, h);
    if (lit) {
      for (let wy = SCENE_H - h + 3; wy < SCENE_H - 2; wy += 4) {
        for (let wx = x + 2; wx < x + w - 1; wx += 3) {
          const on = rand() > 0.55;
          // A few windows flicker slowly.
          const blink = Math.sin(t * 0.3 + wx * 7 + wy) > 0.97;
          if (on && !blink) rect(ctx, rand() > 0.5 ? "#ffc866" : "#ffe3a0", wx, wy, 1, 2);
        }
      }
    }
    x += w;
  }
}

function stars(ctx: CanvasRenderingContext2D, count: number, t: number, maxY: number) {
  const rand = rng(99);
  for (let i = 0; i < count; i++) {
    const x = rand() * SCENE_W;
    const y = rand() * maxY;
    const twinkle = Math.sin(t * (0.8 + rand()) + i) > 0.6;
    rect(ctx, twinkle ? "#ffffff" : "#8eb0f2", x, y, 1, 1);
  }
}

function moon(ctx: CanvasRenderingContext2D, x: number, y: number, skyColor: string) {
  ctx.fillStyle = "#f7edd3";
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skyColor;
  ctx.beginPath();
  ctx.arc(x + 3, y - 2, 6, 0, Math.PI * 2);
  ctx.fill();
}

function pines(ctx: CanvasRenderingContext2D, seed: number, color: string, snowCap: string | null) {
  const rand = rng(seed);
  for (let x = -4; x < SCENE_W; x += 9 + Math.floor(rand() * 8)) {
    const h = 20 + Math.floor(rand() * 22);
    const base = SCENE_H - 4;
    for (let row = 0; row < h; row += 2) {
      const half = Math.max(1, Math.floor((row / h) * 6));
      rect(ctx, color, x - half, base - h + row, half * 2 + 1, 2);
      if (snowCap && row % 6 === 0) rect(ctx, snowCap, x - half, base - h + row, half * 2 + 1, 1);
    }
    rect(ctx, color, x, base, 1, 4);
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, s: SceneState): void {
  ctx.imageSmoothingEnabled = false;
  switch (s.kind) {
    case "city": {
      sky(ctx, ["#0a0a2e", "#0c0c36", "#12114a", "#191760", "#231f7a", "#2d2790"]);
      stars(ctx, 46, s.t, 50);
      moon(ctx, 124, 18, "#12114a");
      skyline(ctx, 4, s.t, "#0b0a24", true);
      break;
    }
    case "rain": {
      sky(ctx, ["#161a3c", "#1c2150", "#232a62", "#2b3474", "#323f84", "#3a4a94"]);
      for (const [cx, cy, w] of [[24, 12, 40], [86, 8, 50], [132, 18, 36]] as const) {
        rect(ctx, "#2a3070", cx, cy, w, 6);
        rect(ctx, "#2a3070", cx + 6, cy - 4, w - 14, 5);
        rect(ctx, "#343c86", cx + 4, cy + 3, w - 10, 3);
      }
      skyline(ctx, 9, s.t, "#10132e", false);
      ctx.fillStyle = "#8eb0f2";
      for (const p of s.particles) ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 3);
      break;
    }
    case "snow": {
      sky(ctx, ["#0c0f2e", "#121640", "#191e52", "#212761", "#2a3170", "#33397d"]);
      stars(ctx, 30, s.t, 44);
      moon(ctx, 30, 20, "#121640");
      pines(ctx, 3, "#0f2a2e", "#dfeaff");
      rect(ctx, "#dfeaff", 0, SCENE_H - 5, SCENE_W, 5);
      rect(ctx, "#b6c8f0", 0, SCENE_H - 1, SCENE_W, 1);
      for (const p of s.particles) rect(ctx, "#ffffff", p.x, p.y, p.y > 40 ? 2 : 1, p.y > 40 ? 2 : 1);
      break;
    }
    case "fireflies": {
      sky(ctx, ["#07142a", "#0a1c36", "#0d2542", "#11304c", "#173b52", "#1d4856"]);
      stars(ctx, 24, s.t, 36);
      pines(ctx, 6, "#06151a", null);
      rect(ctx, "#06151a", 0, SCENE_H - 4, SCENE_W, 4);
      for (const p of s.particles) {
        const glow = (Math.sin(p.phase * 1.6) + 1) / 2;
        if (glow > 0.25) {
          rect(ctx, glow > 0.7 ? "#fff7b0" : "#d8d060", p.x, p.y, 1, 1);
          if (glow > 0.7) {
            ctx.fillStyle = "rgba(255, 240, 140, 0.25)";
            ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
          }
        }
      }
      break;
    }
  }
  if (s.shooting) {
    const { x, y } = s.shooting;
    rect(ctx, "#ffffff", x, y, 2, 1);
    rect(ctx, "#8eb0f2", x - 3, y - 1, 3, 1);
    rect(ctx, "#4a6ab8", x - 7, y - 3, 4, 1);
  }
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(220, 230, 255, ${s.flash * 0.55})`;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  }
}
