import { describe, expect, it } from "vitest";
import { MIN_VISIBLE_X, TITLEBAR_HEIGHT, computeResize } from "./geometry";
import { createInitialState, getWindow, mruWindows, wmReducer } from "./reducer";
import type { OpenWindowInput, WMAction, WMState } from "./types";

const AREA = { x: 0, y: 0, width: 1000, height: 600 };
const base = (appId: string, extra: Partial<OpenWindowInput> = {}): OpenWindowInput => ({
  appId,
  title: appId,
  size: { width: 400, height: 300 },
  minSize: { width: 200, height: 150 },
  resizable: true,
  ...extra,
});

function run(actions: WMAction[], start = createInitialState(AREA)): WMState {
  return actions.reduce(wmReducer, start);
}
const open = (appId: string, extra?: Partial<OpenWindowInput>): WMAction => ({ type: "open", ...base(appId, extra) });

describe("opening and closing", () => {
  it("opens a window, focuses it and puts it in front", () => {
    const s = run([open("a")]);
    expect(s.windows).toHaveLength(1);
    expect(s.focusedId).toBe("win-1");
    expect(s.windows[0]!.z).toBeGreaterThan(0);
  });

  it("keeps new windows inside the work area, even when the app asks for more", () => {
    const s = run([open("a", { size: { width: 5000, height: 5000 } })]);
    const r = s.windows[0]!.rect;
    expect(r.width).toBeLessThanOrEqual(AREA.width);
    expect(r.height).toBeLessThanOrEqual(AREA.height);
  });

  it("cascades successive windows so they don't stack exactly", () => {
    const s = run([open("a"), open("a"), open("a")]);
    const positions = s.windows.map((w) => `${w.rect.x},${w.rect.y}`);
    expect(new Set(positions).size).toBe(3);
  });

  it("focuses the existing window instead of opening a second singleton", () => {
    const s = run([open("settings", { singleton: true }), open("other"), open("settings", { singleton: true })]);
    expect(s.windows.filter((w) => w.appId === "settings")).toHaveLength(1);
    expect(getWindow(s, "win-1")!.z).toBeGreaterThan(getWindow(s, "win-2")!.z);
    expect(s.focusedId).toBe("win-1");
  });

  it("restores and updates props of a minimized singleton when re-opened", () => {
    const s = run([
      open("notes", { singleton: true, props: { a: 1 } }),
      { type: "minimize", id: "win-1" },
      open("notes", { singleton: true, props: { b: 2 } }),
    ]);
    const w = s.windows[0]!;
    expect(w.minimized).toBe(false);
    expect(w.props).toEqual({ a: 1, b: 2 });
    expect(s.focusedId).toBe("win-1");
  });

  it("closes a window and focuses the next one in the stack", () => {
    const s = run([open("a"), open("b"), open("c"), { type: "close", id: "win-3" }]);
    expect(s.windows.map((w) => w.id)).toEqual(["win-1", "win-2"]);
    expect(s.focusedId).toBe("win-2");
  });

  it("clears focus when the last window closes", () => {
    const s = run([open("a"), { type: "close", id: "win-1" }]);
    expect(s.focusedId).toBeNull();
  });

  it("closing a background window does not change focus", () => {
    const s = run([open("a"), open("b"), { type: "close", id: "win-1" }]);
    expect(s.focusedId).toBe("win-2");
  });

  it("ignores actions for unknown windows", () => {
    const s = run([open("a")]);
    for (const action of [
      { type: "close", id: "nope" },
      { type: "focus", id: "nope" },
      { type: "minimize", id: "nope" },
      { type: "move", id: "nope", x: 1, y: 1 },
    ] as WMAction[]) {
      expect(wmReducer(s, action)).toBe(s);
    }
  });

  it("closeAll empties everything", () => {
    const s = run([open("a"), open("b"), { type: "closeAll" }]);
    expect(s.windows).toEqual([]);
    expect(s.focusedId).toBeNull();
  });

  it("remembers where an app was and reopens it there", () => {
    const s = run([
      open("a"),
      { type: "move", id: "win-1", x: 333, y: 222 },
      { type: "close", id: "win-1" },
      open("a"),
    ]);
    expect(s.windows[0]!.rect).toMatchObject({ x: 333, y: 222 });
  });
});

describe("focus and stacking", () => {
  it("raises a window above the others when focused", () => {
    const s = run([open("a"), open("b"), open("c"), { type: "focus", id: "win-1" }]);
    expect(mruWindows(s).map((w) => w.id)).toEqual(["win-1", "win-3", "win-2"]);
    expect(s.focusedId).toBe("win-1");
  });

  it("assigns unique z-indexes", () => {
    const s = run([open("a"), open("b"), open("c"), { type: "focus", id: "win-1" }, { type: "focus", id: "win-2" }]);
    const zs = s.windows.map((w) => w.z);
    expect(new Set(zs).size).toBe(zs.length);
  });

  it("does not churn state when focusing the already-front window", () => {
    const s = run([open("a"), open("b")]);
    expect(wmReducer(s, { type: "focus", id: "win-2" })).toBe(s);
  });

  it("focusing a minimized window restores it", () => {
    const s = run([open("a"), { type: "minimize", id: "win-1" }, { type: "focus", id: "win-1" }]);
    expect(s.windows[0]!.minimized).toBe(false);
    expect(s.focusedId).toBe("win-1");
  });
});

describe("minimize, restore and the taskbar", () => {
  it("minimizing the focused window focuses the next visible one", () => {
    const s = run([open("a"), open("b"), { type: "minimize", id: "win-2" }]);
    expect(getWindow(s, "win-2")!.minimized).toBe(true);
    expect(s.focusedId).toBe("win-1");
  });

  it("leaves nothing focused when every window is minimized", () => {
    const s = run([open("a"), open("b"), { type: "minimize", id: "win-2" }, { type: "minimize", id: "win-1" }]);
    expect(s.focusedId).toBeNull();
  });

  it("skips minimized windows when choosing what to focus next", () => {
    const s = run([open("a"), open("b"), open("c"), { type: "minimize", id: "win-2" }, { type: "minimize", id: "win-3" }]);
    expect(s.focusedId).toBe("win-1");
  });

  it("restores a window in front", () => {
    const s = run([open("a"), open("b"), { type: "minimize", id: "win-1" }, { type: "restore", id: "win-1" }]);
    expect(s.focusedId).toBe("win-1");
    expect(mruWindows(s)[0]!.id).toBe("win-1");
  });

  it("taskbar click: focus a background window, minimize the focused one, restore a minimized one", () => {
    let s = run([open("a"), open("b")]);
    s = wmReducer(s, { type: "toggleFromTaskbar", id: "win-1" });
    expect(s.focusedId).toBe("win-1");
    expect(getWindow(s, "win-1")!.minimized).toBe(false);

    s = wmReducer(s, { type: "toggleFromTaskbar", id: "win-1" });
    expect(getWindow(s, "win-1")!.minimized).toBe(true);
    expect(s.focusedId).toBe("win-2");

    s = wmReducer(s, { type: "toggleFromTaskbar", id: "win-1" });
    expect(getWindow(s, "win-1")!.minimized).toBe(false);
    expect(s.focusedId).toBe("win-1");
  });
});

describe("maximize", () => {
  it("maximizes and restores while keeping the original bounds", () => {
    const opened = run([open("a")]);
    const original = opened.windows[0]!.rect;
    const max = wmReducer(opened, { type: "maximize", id: "win-1" });
    expect(max.windows[0]!.maximized).toBe(true);
    expect(max.windows[0]!.rect).toEqual(original);
    const back = wmReducer(max, { type: "unmaximize", id: "win-1" });
    expect(back.windows[0]!.maximized).toBe(false);
    expect(back.windows[0]!.rect).toEqual(original);
  });

  it("toggles maximize", () => {
    const s = run([open("a"), { type: "toggleMaximize", id: "win-1" }]);
    expect(s.windows[0]!.maximized).toBe(true);
    expect(wmReducer(s, { type: "toggleMaximize", id: "win-1" }).windows[0]!.maximized).toBe(false);
  });

  it("refuses to maximize windows that are not resizable", () => {
    const s = run([open("calc", { resizable: false }), { type: "maximize", id: "win-1" }]);
    expect(s.windows[0]!.maximized).toBe(false);
  });

  it("dragging a maximized window restores it at the new position", () => {
    const s = run([open("a"), { type: "maximize", id: "win-1" }, { type: "move", id: "win-1", x: 150, y: 90 }]);
    expect(s.windows[0]!.maximized).toBe(false);
    expect(s.windows[0]!.rect).toMatchObject({ x: 150, y: 90 });
  });

  it("ignores resize while maximized", () => {
    const max = run([open("a"), { type: "maximize", id: "win-1" }]);
    expect(wmReducer(max, { type: "resize", id: "win-1", rect: { x: 0, y: 0, width: 300, height: 300 } })).toBe(max);
  });
});

describe("moving and resizing", () => {
  it("moves a window", () => {
    const s = run([open("a"), { type: "move", id: "win-1", x: 200, y: 100 }]);
    expect(s.windows[0]!.rect).toMatchObject({ x: 200, y: 100 });
  });

  it("never lets a window leave the screen entirely", () => {
    const w = run([open("a")]);
    const far = (x: number, y: number) => wmReducer(w, { type: "move", id: "win-1", x, y }).windows[0]!.rect;
    expect(far(99999, 0).x).toBe(AREA.width - MIN_VISIBLE_X);
    expect(far(-99999, 0).x).toBe(-400 + MIN_VISIBLE_X);
    expect(far(0, -500).y).toBe(0);
    expect(far(0, 99999).y).toBe(AREA.height - TITLEBAR_HEIGHT);
  });

  it("enforces minimum size when resizing", () => {
    const s = run([open("a"), { type: "resize", id: "win-1", rect: { x: 10, y: 10, width: 20, height: 20 } }]);
    expect(s.windows[0]!.rect).toMatchObject({ width: 200, height: 150 });
  });

  it("caps size at the work area", () => {
    const s = run([open("a"), { type: "resize", id: "win-1", rect: { x: 0, y: 0, width: 9999, height: 9999 } }]);
    expect(s.windows[0]!.rect).toMatchObject({ width: AREA.width, height: AREA.height });
  });

  it("does not resize fixed-size windows", () => {
    const s = run([open("calc", { resizable: false })]);
    expect(wmReducer(s, { type: "resize", id: "win-1", rect: { x: 0, y: 0, width: 999, height: 500 } })).toBe(s);
  });

  it("shrinks and repositions windows when the work area shrinks", () => {
    const s = run([open("a"), { type: "move", id: "win-1", x: 800, y: 400 }, { type: "setWorkArea", rect: { x: 0, y: 0, width: 500, height: 300 } }]);
    const r = s.windows[0]!.rect;
    expect(r.x).toBeLessThanOrEqual(500 - MIN_VISIBLE_X);
    expect(r.y).toBeLessThanOrEqual(300 - TITLEBAR_HEIGHT);
    expect(r.width).toBeLessThanOrEqual(500);
  });

  it("updates titles", () => {
    const s = run([open("a"), { type: "setTitle", id: "win-1", title: "Report.md" }]);
    expect(s.windows[0]!.title).toBe("Report.md");
  });
});

describe("computeResize", () => {
  const start = { x: 100, y: 100, width: 400, height: 300 };
  const min = { width: 200, height: 150 };
  const area = { x: 0, y: 0, width: 1000, height: 600 };

  it("grows from the south-east corner", () => {
    expect(computeResize(start, "se", 50, 30, min, area)).toEqual({ x: 100, y: 100, width: 450, height: 330 });
  });

  it("moves the origin when resizing from the west or north", () => {
    expect(computeResize(start, "w", -40, 0, min, area)).toEqual({ x: 60, y: 100, width: 440, height: 300 });
    expect(computeResize(start, "n", 0, -30, min, area)).toEqual({ x: 100, y: 70, width: 400, height: 330 });
  });

  it("keeps the opposite edge fixed when hitting the minimum size", () => {
    const r = computeResize(start, "w", 9999, 0, min, area);
    expect(r.width).toBe(200);
    expect(r.x + r.width).toBe(500);
  });

  it("does not let the top edge go above the work area", () => {
    const r = computeResize(start, "n", 0, -9999, min, area);
    expect(r.y).toBe(0);
    expect(r.y + r.height).toBe(400);
  });
});
