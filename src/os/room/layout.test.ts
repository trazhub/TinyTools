import { describe, expect, it } from "vitest";
import { buildSprite, spriteSize } from "../pixel/registry";
import { ROOM_ITEMS, SHADOWS, STAGE_H, STAGE_W, fitStage, placedItems, type RoomAction } from "./layout";
import { OBJECT_APPS } from "./actions";
import { APPS } from "../apps/registry";

describe("fitStage", () => {
  it("uses half-step scales on large screens and centres the stage", () => {
    const fit = fitStage(1366, 648);
    expect(fit.scale).toBe(3.5);
    expect(fit.width).toBe(STAGE_W * 3.5);
    expect(fit.x).toBe(Math.round((1366 - fit.width) / 2));
    expect(fit.y).toBe(Math.round((648 - fit.height) / 2));
  });

  it("never exceeds the available area", () => {
    for (const [w, h] of [[1920, 1080], [1366, 648], [1024, 600], [800, 400], [390, 560], [320, 300], [3840, 2160]] as const) {
      const fit = fitStage(w, h);
      expect(fit.width, `${w}x${h}`).toBeLessThanOrEqual(w);
      expect(fit.height, `${w}x${h}`).toBeLessThanOrEqual(h);
      expect(fit.scale).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("shows the whole room on phones with a fractional scale", () => {
    const fit = fitStage(390, 560);
    expect(fit.scale).toBeCloseTo(390 / STAGE_W, 1);
    expect(fit.width).toBeLessThanOrEqual(390);
  });

  it("caps the scale on huge screens", () => {
    expect(fitStage(10_000, 10_000).scale).toBe(10);
  });
});

describe("room layout", () => {
  const items = placedItems();

  it("has unique ids", () => {
    expect(new Set(ROOM_ITEMS.map((i) => i.id)).size).toBe(ROOM_ITEMS.length);
  });

  it("keeps every item inside the 320x180 stage", () => {
    for (const item of items) {
      expect(item.x, item.id).toBeGreaterThanOrEqual(0);
      expect(item.y, item.id).toBeGreaterThanOrEqual(0);
      expect(item.x + item.width, item.id).toBeLessThanOrEqual(STAGE_W);
      expect(item.y + item.height, item.id).toBeLessThanOrEqual(STAGE_H);
    }
    for (const s of SHADOWS) {
      expect(s.x + s.w).toBeLessThanOrEqual(STAGE_W);
      expect(s.y + s.h).toBeLessThanOrEqual(STAGE_H);
    }
  });

  it("every animated item's frames share a size", () => {
    for (const item of ROOM_ITEMS.filter((i) => i.frames && i.frames.length > 1)) {
      const sizes = new Set(item.frames!.map((f) => JSON.stringify(spriteSize(item.sprite, f))));
      expect(sizes.size, item.id).toBe(1);
      expect(item.cycle, item.id).toBeGreaterThan(0);
    }
  });

  it("gives every interactive object a label and a behaviour", () => {
    const interactive = ROOM_ITEMS.filter((i) => i.action);
    expect(interactive.length).toBeGreaterThanOrEqual(15);
    for (const item of interactive) expect(item.label, item.id).toBeTruthy();
  });

  it("covers the required objects, each mapped to the right app", () => {
    const byAction = new Map(ROOM_ITEMS.filter((i) => i.action).map((i) => [i.action as RoomAction, i]));
    for (const action of ["computer", "bookshelf", "notebook", "window", "character", "record", "handheld", "bed"] as const) expect(byAction.has(action), action).toBe(true);
    expect(OBJECT_APPS.bookshelf).toBe("explorer");
    expect(OBJECT_APPS.notebook).toBe("notes");
    expect(OBJECT_APPS.window).toBe("ambient");
  });

  it("only launches apps that exist", () => {
    const ids = new Set(APPS.map((a) => a.id));
    for (const [action, app] of Object.entries(OBJECT_APPS)) expect(ids.has(app!), `${action} -> ${app}`).toBe(true);
  });

  it("draws things behind others in the right order", () => {
    const order = items.map((i) => i.id);
    const before = (a: string, b: string) => expect(order.indexOf(a), `${a} before ${b}`).toBeLessThan(order.indexOf(b));
    before("rug", "character");
    before("bed", "cat-bed");
    before("cushion", "cat-cushion");
    before("bookshelf", "vines");
    before("desk", "computer");
    before("desk", "chair");
  });

  it("never leaves a sprite empty", () => {
    for (const item of items) expect(buildSprite(item.sprite, item.frames?.[0] ?? "").cells.some(Boolean), item.id).toBe(true);
  });
});
