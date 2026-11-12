import { describe, expect, it } from "vitest";
import { APPS } from "../apps/registry";
import { searchApps } from "./search";

const ids = (q: string) => searchApps(APPS, q).map((a) => a.id);

describe("app registry integrity", () => {
  it("has unique ids and names", () => {
    expect(new Set(APPS.map((a) => a.id)).size).toBe(APPS.length);
    expect(new Set(APPS.map((a) => a.name)).size).toBe(APPS.length);
  });

  it("gives every app a description, sensible sizes and a component", () => {
    for (const a of APPS) {
      expect(a.description.length, a.id).toBeGreaterThan(10);
      expect(a.minSize.width, a.id).toBeLessThanOrEqual(a.size.width);
      expect(a.minSize.height, a.id).toBeLessThanOrEqual(a.size.height);
      expect(a.component, a.id).toBeDefined();
      expect(a.id, a.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("searchApps", () => {
  it("returns everything for an empty query", () => {
    expect(ids("")).toHaveLength(APPS.length);
    expect(ids("   ")).toHaveLength(APPS.length);
  });

  it("finds by name, id, keyword and description", () => {
    expect(ids("term")[0]).toBe("terminal");
    expect(ids("calc")[0]).toBe("calculator");
    expect(ids("shell")).toContain("terminal");
    expect(ids("theme")).toContain("settings");
    expect(ids("utf-8")).toContain("base64");
  });

  it("ranks name matches above description-only matches", () => {
    expect(ids("notes")[0]).toBe("notes");
    expect(ids("file")[0]).toBe("explorer");
  });

  it("is case- and accent-insensitive", () => {
    expect(ids("TERMINAL")).toEqual(ids("terminal"));
    expect(ids("térmïnal")).toContain("terminal");
  });

  it("requires every word to match", () => {
    expect(ids("json terminal")).toEqual([]);
    expect(ids("compress image")).toContain("image-compressor");
  });

  it("returns nothing for gibberish and survives regex characters", () => {
    expect(ids("zzzqqqxxx")).toEqual([]);
    expect(() => ids("(.*[")).not.toThrow();
  });
});
