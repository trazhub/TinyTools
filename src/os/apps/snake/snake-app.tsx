"use client";

import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJson, writeJson } from "../../storage/safe-storage";
import { useKernel } from "../../system/kernel-context";
import { createGame, step, tickDelay, togglePause, turn, type Dir, type SnakeState } from "./snake";

const COLS = 20;
const ROWS = 15;
const CELL = 16;
const BEST_KEY = "tinytools-os:snake-best";

type Action = { type: "tick" } | { type: "turn"; dir: Dir } | { type: "pause" } | { type: "restart" };

function reducer(state: SnakeState, action: Action): SnakeState {
  switch (action.type) {
    case "tick":
      return step(state, Math.random);
    case "turn":
      return turn(state, action.dir);
    case "pause":
      return togglePause(state);
    case "restart":
      return createGame(COLS, ROWS, Math.random);
  }
}

const KEYS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };

function loadBest(): number {
  const raw = readJson("local", BEST_KEY);
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
}

export default function SnakeApp() {
  const kernel = useKernel();
  const [game, dispatch] = useReducer(reducer, undefined, () => createGame(COLS, ROWS, Math.random));
  const [best, setBest] = useState(loadBest);
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const eaten = useRef(0);

  // The game loop: one tick per interval, faster as the score grows.
  useEffect(() => {
    if (game.status !== "playing") return;
    const timer = setInterval(() => dispatch({ type: "tick" }), tickDelay(game.score));
    return () => clearInterval(timer);
  }, [game.status, game.score]);

  // Sounds and the high score react to what just happened.
  useEffect(() => {
    if (game.score > eaten.current) kernel.sfx("pop");
    eaten.current = game.score;
  }, [game.score, kernel]);
  const over = game.status === "over" || game.status === "won";
  // The best score on show includes the game that just ended; it is folded into `best` on restart.
  const shownBest = Math.max(best, over ? game.score : 0);
  useEffect(() => {
    if (!over) return;
    kernel.sfx(game.status === "won" ? "select" : "error");
    if (game.score > best) writeJson("local", BEST_KEY, game.score);
  }, [over, game.status, game.score, best, kernel]);

  const restart = () => {
    setBest(shownBest);
    dispatch({ type: "restart" });
  };

  // Draw
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0d0c2b";
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.fillStyle = "#15134a";
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    if (game.food) {
      const { x, y } = game.food;
      ctx.fillStyle = "#ff8a82";
      ctx.fillRect(x * CELL + 3, y * CELL + 4, CELL - 6, CELL - 6);
      ctx.fillStyle = "#86e8a6";
      ctx.fillRect(x * CELL + 7, y * CELL + 1, 3, 4);
    }
    game.snake.forEach((c, i) => {
      ctx.fillStyle = i === 0 ? "#c6ffd8" : i % 2 ? "#4fbf7a" : "#5fd18a";
      ctx.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
      if (i === 0) {
        ctx.fillStyle = "#070618";
        ctx.fillRect(c.x * CELL + 4, c.y * CELL + 5, 3, 3);
        ctx.fillRect(c.x * CELL + 9, c.y * CELL + 5, 3, 3);
      }
    });
  }, [game]);

  useEffect(() => root.current?.focus({ preventScroll: true }), []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEYS[e.key];
    if (dir) {
      e.preventDefault();
      dispatch({ type: "turn", dir });
    } else if (e.key === " " || e.key === "p" || e.key === "P") {
      if ((e.target as HTMLElement).tagName === "BUTTON") return;
      e.preventDefault();
      if (over) restart();
      else dispatch({ type: "pause" });
    } else if (e.key === "Enter" && over) {
      e.preventDefault();
      restart();
    }
  };

  // Swipe to steer on touch screens.
  const onPointerDown = (e: PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      if (game.status === "paused" || game.status === "ready") dispatch({ type: "pause" });
      return;
    }
    dispatch({ type: "turn", dir: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up" });
  };

  const pad = (dir: Dir, label: string, Icon: typeof ArrowUp) => (
    <Button size="icon" variant="secondary" aria-label={label} onClick={() => dispatch({ type: "turn", dir })} className="size-12">
      <Icon aria-hidden />
    </Button>
  );

  return (
    <div ref={root} tabIndex={0} onKeyDown={onKeyDown} className="flex h-full flex-col items-center gap-4 overflow-y-auto p-4 outline-none" data-testid="snake" aria-label="Snake. Use arrow keys or WASD to steer.">
      <div className="flex w-full max-w-[480px] items-center justify-between gap-3">
        <p className="font-pixel text-[18px]" aria-live="polite">
          Score <span data-testid="snake-score" className="font-bold text-primary">{game.score}</span>
        </p>
        <p className="font-pixel flex items-center gap-1.5 text-[18px] text-muted-foreground">
          <Trophy className="size-4" aria-hidden /> Best <span data-testid="snake-best">{shownBest}</span>
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => dispatch({ type: "pause" })} disabled={over} aria-label={game.status === "playing" ? "Pause" : "Play"}>
            {game.status === "playing" ? <Pause aria-hidden /> : <Play aria-hidden />}
          </Button>
          <Button size="sm" variant="outline" onClick={restart} aria-label="Restart">
            <RotateCcw aria-hidden />
          </Button>
        </div>
      </div>

      <div className="relative w-full max-w-[480px]">
        <canvas
          ref={canvas}
          width={COLS * CELL}
          height={ROWS * CELL}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          role="img"
          aria-label={`Snake board. Score ${game.score}.`}
          className="w-full touch-none border-4 border-[var(--px-bd)] [image-rendering:pixelated]"
          style={{ aspectRatio: `${COLS} / ${ROWS}` }}
        />
        {game.status !== "playing" && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 p-4 text-center" role="status">
            <div className="space-y-3">
              <p className="font-pixel text-[26px] font-bold text-foreground">
                {game.status === "ready" ? "Snake" : game.status === "paused" ? "Paused" : game.status === "won" ? "You filled the board!" : "Game over"}
              </p>
              <p className="font-pixel text-[16px] text-muted-foreground">
                {game.status === "ready" ? "Arrow keys, WASD or swipe to start" : game.status === "paused" ? "Press Space to continue" : `Score ${game.score}`}
              </p>
              {over ? (
                <Button onClick={restart}>Play again</Button>
              ) : (
                <Button onClick={() => dispatch({ type: "pause" })}>{game.status === "ready" ? "Start" : "Resume"}</Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2" aria-label="On-screen controls">
        <span />
        {pad("up", "Up", ArrowUp)}
        <span />
        {pad("left", "Left", ArrowLeft)}
        {pad("down", "Down", ArrowDown)}
        {pad("right", "Right", ArrowRight)}
      </div>
    </div>
  );
}
