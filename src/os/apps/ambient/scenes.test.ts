import { describe, expect, it } from "vitest";
import { rng } from "../../pixel/sprites";
import { SCENES, SCENE_H, SCENE_W, createScene, stepScene, type SceneKind } from "./scenes";

const KINDS = SCENES.map((s) => s.id);

describe("scene catalogue", () => {
  it("has unique ids and descriptions", () => {
    expect(new Set(KINDS).size).toBe(KINDS.length);
    for (const s of SCENES) expect(s.blurb.length, s.id).toBeGreaterThan(10);
  });
});

describe("createScene", () => {
  it("populates scenes with particles (except the quiet city)", () => {
    expect(createScene("city", rng(1)).particles).toHaveLength(0);
    for (const k of ["rain", "snow", "fireflies"] as SceneKind[]) expect(createScene(k, rng(1)).particles.length, k).toBeGreaterThan(10);
  });

  it("is deterministic for a seed", () => {
    expect(createScene("rain", rng(5))).toEqual(createScene("rain", rng(5)));
  });

  it("starts every particle on screen", () => {
    for (const k of KINDS) {
      for (const p of createScene(k, rng(2)).particles) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(SCENE_W);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(SCENE_H);
      }
    }
  });
});

describe("stepScene", () => {
  it("keeps every particle in a sane region over a long run", () => {
    for (const kind of KINDS) {
      const rand = rng(3);
      const scene = createScene(kind, rand);
      for (let i = 0; i < 2000; i++) stepScene(scene, 1 / 30, rand);
      for (const p of scene.particles) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y), kind).toBe(true);
        expect(p.x, kind).toBeGreaterThanOrEqual(-10);
        expect(p.x, kind).toBeLessThanOrEqual(SCENE_W + 10);
        expect(p.y, kind).toBeGreaterThanOrEqual(-10);
        expect(p.y, kind).toBeLessThanOrEqual(SCENE_H + 10);
      }
    }
  });

  it("rain falls and recycles at the top", () => {
    const rand = rng(4);
    const scene = createScene("rain", rand);
    const before = scene.particles.map((p) => p.y);
    stepScene(scene, 0.05, rand);
    expect(scene.particles.filter((p, i) => p.y > before[i]!).length).toBeGreaterThan(scene.particles.length * 0.8);
    for (let i = 0; i < 400; i++) stepScene(scene, 0.05, rand);
    expect(scene.particles.every((p) => p.y <= SCENE_H + 1)).toBe(true);
  });

  it("fireflies never leave the scene", () => {
    const rand = rng(8);
    const scene = createScene("fireflies", rand);
    for (let i = 0; i < 3000; i++) stepScene(scene, 1 / 30, rand);
    for (const p of scene.particles) {
      expect(p.x).toBeGreaterThanOrEqual(2);
      expect(p.x).toBeLessThanOrEqual(SCENE_W - 2);
      expect(p.y).toBeGreaterThanOrEqual(8);
      expect(p.y).toBeLessThanOrEqual(SCENE_H - 6);
    }
  });

  it("caps huge time steps so a backgrounded tab doesn't teleport everything", () => {
    const rand = rng(9);
    const scene = createScene("snow", rand);
    stepScene(scene, 60, rand);
    expect(scene.t).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  it("triggers lightning in the rain and lets it fade", () => {
    const rand = rng(10);
    const scene = createScene("rain", rand);
    let flashed = false;
    for (let i = 0; i < 1200; i++) {
      stepScene(scene, 1 / 30, rand);
      if (scene.flash > 0.9) flashed = true;
    }
    expect(flashed).toBe(true);
    for (let i = 0; i < 60; i++) stepScene(scene, 1 / 30, () => 0.99);
    expect(scene.flash).toBeLessThanOrEqual(1);
  });

  it("launches and retires shooting stars", () => {
    const rand = rng(12);
    const scene = createScene("city", rand);
    let saw = false;
    for (let i = 0; i < 2000; i++) {
      stepScene(scene, 1 / 30, rand);
      if (scene.shooting) saw = true;
    }
    expect(saw).toBe(true);
  });
});
