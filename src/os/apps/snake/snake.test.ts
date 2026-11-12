import { describe, expect, it } from "vitest";
import { createGame, placeFood, step, tickDelay, togglePause, turn, type SnakeState } from "./snake";

const fixed = (n: number) => () => n;
const playing = (over: Partial<SnakeState> = {}): SnakeState => ({ ...createGame(10, 8, fixed(0)), status: "playing", ...over });

describe("placeFood", () => {
  it("never places food on the snake", () => {
    const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    for (let i = 0; i < 50; i++) {
      const f = placeFood(snake, 3, 2, () => i / 50);
      expect(snake.some((c) => c.x === f!.x && c.y === f!.y)).toBe(false);
    }
  });
  it("returns null when the board is full", () => {
    expect(placeFood([{ x: 0, y: 0 }], 1, 1, fixed(0.5))).toBeNull();
  });
  it("copes with a random value of exactly 1", () => {
    expect(placeFood([], 2, 2, fixed(1))).toEqual({ x: 1, y: 1 });
  });
});

describe("movement", () => {
  it("waits for the first turn before moving", () => {
    const g = createGame(10, 8, fixed(0));
    expect(g.status).toBe("ready");
    expect(step(g, fixed(0))).toBe(g);
    expect(turn(g, "up").status).toBe("playing");
  });

  it("moves one cell per step in its direction", () => {
    const g = playing();
    const s = step(g, fixed(0));
    expect(s.snake[0]).toEqual({ x: g.snake[0]!.x + 1, y: g.snake[0]!.y });
    expect(s.snake).toHaveLength(g.snake.length);
  });

  it("ignores a 180 degree reversal, even queued twice in one tick", () => {
    let g = playing({ dir: "right", queued: "right" });
    g = turn(g, "left");
    expect(g.queued).toBe("right");
    g = turn(turn(g, "up"), "left");
    // "up" was queued, then "left" would reverse relative to the current travel direction: ignored
    expect(step(g, fixed(0)).dir).not.toBe("left");
  });

  it("turns when asked", () => {
    const g = turn(playing(), "down");
    expect(step(g, fixed(0)).dir).toBe("down");
  });
});

describe("eating and growing", () => {
  it("grows, scores and places new food", () => {
    const g = playing({ food: { x: 5, y: 4 } });
    const s = step(g, fixed(0));
    expect(s.score).toBe(1);
    expect(s.snake).toHaveLength(g.snake.length + 1);
    expect(s.food).not.toEqual({ x: 5, y: 4 });
  });

  it("wins when the board fills up", () => {
    const g: SnakeState = { cols: 3, rows: 1, snake: [{ x: 1, y: 0 }, { x: 0, y: 0 }], dir: "right", queued: "right", food: { x: 2, y: 0 }, score: 0, status: "playing" };
    expect(step(g, fixed(0)).status).toBe("won");
  });
});

describe("game over", () => {
  it("ends when hitting each wall", () => {
    for (const [dir, snake] of [
      ["up", [{ x: 2, y: 0 }, { x: 2, y: 1 }]],
      ["down", [{ x: 2, y: 7 }, { x: 2, y: 6 }]],
      ["left", [{ x: 0, y: 3 }, { x: 1, y: 3 }]],
      ["right", [{ x: 9, y: 3 }, { x: 8, y: 3 }]],
    ] as const) {
      const g = playing({ snake: [...snake], dir, queued: dir, food: { x: 5, y: 5 } });
      expect(step(g, fixed(0)).status, dir).toBe("over");
    }
  });

  it("ends when running into itself", () => {
    const snake = [{ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 3 }, { x: 4, y: 2 }, { x: 3, y: 2 }];
    const g = playing({ snake, dir: "up", queued: "up", food: { x: 9, y: 7 } });
    expect(step(turn(g, "right"), fixed(0)).status).toBe("over");
  });

  it("lets the head move into the cell the tail just left", () => {
    const snake = [{ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 3 }];
    const g = playing({ snake, dir: "up", queued: "up", food: { x: 9, y: 7 } });
    const s = step(turn(g, "right"), fixed(0));
    expect(s.status).toBe("playing");
  });

  it("stays over: nothing moves or turns afterwards", () => {
    const over = { ...playing(), status: "over" as const };
    expect(step(over, fixed(0))).toBe(over);
    expect(turn(over, "up")).toBe(over);
    expect(togglePause(over)).toBe(over);
  });
});

describe("pause and speed", () => {
  it("toggles pause", () => {
    expect(togglePause(playing()).status).toBe("paused");
    expect(togglePause(togglePause(playing())).status).toBe("playing");
    expect(step(togglePause(playing()), fixed(0)).snake).toEqual(playing().snake);
  });
  it("speeds up but never below the floor", () => {
    expect(tickDelay(0)).toBe(170);
    expect(tickDelay(10)).toBeLessThan(tickDelay(0));
    expect(tickDelay(1000)).toBe(70);
  });
});
