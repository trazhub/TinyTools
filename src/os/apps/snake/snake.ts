/** Snake, as pure functions so the rules can be tested without a screen. */

export type Dir = "up" | "down" | "left" | "right";
export interface Cell {
  x: number;
  y: number;
}

export interface SnakeState {
  cols: number;
  rows: number;
  /** Head first. */
  snake: Cell[];
  dir: Dir;
  /** The direction queued by the player; applied on the next step. */
  queued: Dir;
  food: Cell | null;
  score: number;
  status: "ready" | "playing" | "paused" | "over" | "won";
}

const DELTA: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

export type Random = () => number;

/** A random free cell, or null when the snake fills the board. */
export function placeFood(snake: readonly Cell[], cols: number, rows: number, rand: Random): Cell | null {
  const taken = new Set(snake.map((c) => `${c.x},${c.y}`));
  const free: Cell[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!taken.has(`${x},${y}`)) free.push({ x, y });
  return free.length ? free[Math.min(free.length - 1, Math.floor(rand() * free.length))]! : null;
}

export function createGame(cols: number, rows: number, rand: Random): SnakeState {
  const y = Math.floor(rows / 2);
  const snake = [{ x: 4, y }, { x: 3, y }, { x: 2, y }];
  return { cols, rows, snake, dir: "right", queued: "right", food: placeFood(snake, cols, rows, rand), score: 0, status: "ready" };
}

/** Queue a turn. A 180-degree reversal is ignored (it would be instant death). Starts the game if it was waiting. */
export function turn(state: SnakeState, dir: Dir): SnakeState {
  if (state.status === "over" || state.status === "won") return state;
  // Compare with the direction we will actually travel next, so two quick taps can't reverse us.
  if (OPPOSITE[dir] === state.dir) return state;
  return { ...state, queued: dir, status: state.status === "ready" ? "playing" : state.status };
}

export function togglePause(state: SnakeState): SnakeState {
  if (state.status === "playing") return { ...state, status: "paused" };
  if (state.status === "paused" || state.status === "ready") return { ...state, status: "playing" };
  return state;
}

/** Advance one tick. Does nothing unless the game is being played. */
export function step(state: SnakeState, rand: Random): SnakeState {
  if (state.status !== "playing") return state;
  const dir = OPPOSITE[state.queued] === state.dir ? state.dir : state.queued;
  const head = state.snake[0]!;
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };

  const hitsWall = next.x < 0 || next.y < 0 || next.x >= state.cols || next.y >= state.rows;
  const eating = state.food !== null && next.x === state.food.x && next.y === state.food.y;
  // The tail moves out of the way this tick unless we are growing.
  const body = eating ? state.snake : state.snake.slice(0, -1);
  const hitsSelf = body.some((c) => c.x === next.x && c.y === next.y);
  if (hitsWall || hitsSelf) return { ...state, dir, status: "over" };

  const snake = [next, ...body];
  if (!eating) return { ...state, snake, dir };
  const food = placeFood(snake, state.cols, state.rows, rand);
  return { ...state, snake, dir, food, score: state.score + 1, status: food ? "playing" : "won" };
}

/** Milliseconds per tick; the game speeds up as the score grows, down to a floor. */
export function tickDelay(score: number): number {
  return Math.max(70, 170 - score * 5);
}
