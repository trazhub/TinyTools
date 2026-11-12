"use client";

import { memo, useMemo } from "react";
import { Sprite, usePixel } from "../pixel/pixel-context";
import { cn } from "@/lib/utils";
import { ROOM_ITEMS, SHADOWS, STAGE_H, STAGE_W, placedItems, type PlacedItem, type RoomItem } from "./layout";

export interface StageEffect {
  id: number;
  kind: "heart" | "sparkle" | "note";
  x: number;
  y: number;
}

interface RoomStageProps {
  /** Hotspots only exist when the room is interactive (not on the title-screen preview). */
  interactive: boolean;
  /** "HH:MM" for the alarm clock. */
  time: string;
  lightsOff: boolean;
  musicPlaying: boolean;
  hotId: string | null;
  highlightId: string | null;
  effects: readonly StageEffect[];
  onHot: (id: string | null) => void;
  onActivate: (item: RoomItem) => void;
}

/** Draws the room at its native 320x180 resolution; the parent scales it up. */
export const RoomStage = memo(function RoomStage({ interactive, time, lightsOff, musicPlaying, hotId, highlightId, effects, onHot, onActivate }: RoomStageProps) {
  const { theme } = usePixel();
  const items = useMemo(() => placedItems(), []);
  const hotspots = useMemo(
    () =>
      items
        .filter((i) => i.action)
        // Left to right is the keyboard order; smaller objects sit on top so they stay clickable.
        .sort((a, b) => a.x - b.x),
    [items],
  );

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: STAGE_W, height: STAGE_H }}
      role="group"
      aria-label="Your room. Choose an object to open an app."
      data-testid="room-stage"
    >
      <Sprite id="shell" className="absolute left-0 top-0" />

      {SHADOWS.map((s, i) => (
        <div key={i} aria-hidden className="absolute bg-black/25" style={{ left: s.x, top: s.y, width: s.w, height: s.h, borderRadius: "50%" }} />
      ))}

      {/* Art layer */}
      <div aria-hidden>
        {items.map((item) => (
          <ItemArt key={item.id} item={item} hot={hotId === item.id || highlightId === item.id} time={time} sky={theme.sky} />
        ))}
      </div>

      <Atmosphere sky={theme.sky} lightsOff={lightsOff} musicPlaying={musicPlaying} />

      {/* Effects (hearts, sparkles, music notes) */}
      {effects.map((e) => (
        <div key={e.id} aria-hidden className="pointer-events-none absolute" style={{ left: e.x, top: e.y, animation: "px-float 1.2s steps(8, end) forwards" }}>
          <Sprite id={e.kind === "heart" ? "heart" : e.kind === "note" ? "note" : "sparkle"} />
        </div>
      ))}

      {/* Hotspot layer: real buttons, so mouse, touch and keyboard all work */}
      {interactive &&
        hotspots.map((item) => {
          const pad = item.hitPad ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              data-hotspot={item.action}
              aria-label={item.label}
              className="absolute bg-transparent outline-offset-0 focus-visible:outline-dashed focus-visible:outline-1 focus-visible:outline-[#ffc866]"
              style={{
                left: item.x - pad,
                top: item.y - pad,
                width: item.width + pad * 2,
                height: item.height + pad * 2,
                cursor: "var(--px-hand, pointer)",
                zIndex: 1000 - Math.round((item.width * item.height) / 40),
              }}
              onPointerEnter={() => onHot(item.id)}
              onPointerLeave={() => onHot(null)}
              onFocus={() => onHot(item.id)}
              onBlur={() => onHot(null)}
              onClick={() => onActivate(item)}
            />
          );
        })}
    </div>
  );
});

const ItemArt = memo(function ItemArt({ item, hot, time, sky }: { item: PlacedItem; hot: boolean; time: string; sky: string }) {
  const frames = item.id === "clock" ? [time] : item.sprite === "window" ? [sky] : (item.frames ?? [""]);
  return (
    <div
      data-item={item.id}
      data-hot={hot}
      className={cn("px-item absolute", frames.length > 1 && "px-seq")}
      style={{ left: item.x, top: item.y, width: item.width, height: item.height, ["--cycle" as string]: `${item.cycle ?? 2}s` }}
    >
      {frames.slice(0, 2).map((frame, i) => (
        <Sprite key={`${frame}-${i}`} id={item.sprite} variant={frame} />
      ))}
    </div>
  );
});

/** Lighting and ambience: lamp and monitor glow, moonlight, twinkling stars and drifting dust. */
function Atmosphere({ sky, lightsOff, musicPlaying }: { sky: string; lightsOff: boolean; musicPlaying: boolean }) {
  const dust = useMemo(() => [
    { x: 40, y: 100, dx: 8, d: 7, delay: 0 },
    { x: 120, y: 60, dx: -6, d: 9, delay: 2 },
    { x: 190, y: 110, dx: 10, d: 8, delay: 4 },
    { x: 240, y: 70, dx: -8, d: 10, delay: 1 },
    { x: 280, y: 120, dx: 6, d: 7, delay: 5 },
    { x: 80, y: 140, dx: 9, d: 11, delay: 3 },
  ], []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* Moonlight falling across the floor */}
      <div
        className="absolute"
        style={{
          left: 212,
          top: 78,
          width: 110,
          height: 100,
          clipPath: "polygon(30% 0, 78% 0, 100% 100%, 0 100%)",
          background: sky === "day" ? "linear-gradient(to bottom, rgb(255 244 200 / 0.28), transparent)" : "linear-gradient(to bottom, rgb(140 170 255 / 0.2), transparent)",
          mixBlendMode: "screen",
        }}
      />
      {/* Lights-off darkness, then the lamp and monitor pockets of light on top of it */}
      <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: lightsOff ? 1 : 0, background: "rgb(18 16 60 / 0.72)", mixBlendMode: "multiply" }} />
      <div className="px-glow absolute" style={{ left: 150, top: 6, width: 190, height: 150, background: "radial-gradient(closest-side, rgb(var(--px-glow) / 0.5), rgb(var(--px-glow) / 0.16) 55%, transparent)", animation: "px-flicker 7s steps(1, end) infinite" }} />
      <div className="px-glow absolute" style={{ left: 134, top: 34, width: 84, height: 70, background: "radial-gradient(closest-side, rgb(140 190 255 / 0.3), transparent)" }} />
      {lightsOff && <div className="px-glow absolute" style={{ left: 246, top: 4, width: 76, height: 80, background: "radial-gradient(closest-side, rgb(150 180 255 / 0.28), transparent)" }} />}
      {/* Stars twinkling in the window */}
      {sky !== "day" &&
        [[256, 14], [266, 22], [284, 16], [300, 26]].map(([x, y], i) => (
          <div key={i} className="absolute bg-[#c2d4fb]" style={{ left: x, top: y, width: 1, height: 1, animation: `px-twinkle ${3 + i}s steps(1, end) infinite`, animationDelay: `${i * 0.7}s` }} />
        ))}
      {/* Dust motes in the lamplight */}
      {dust.map((d, i) => (
        <div key={i} className="absolute bg-[#ffe3a0]" style={{ left: d.x, top: d.y, width: 1, height: 1, opacity: 0, ["--dx" as string]: `${d.dx}px`, animation: `px-dust ${d.d}s linear infinite`, animationDelay: `${d.delay}s` }} />
      ))}
      {musicPlaying && (
        <div className="absolute" style={{ left: 266, top: 62, animation: "px-float 2.4s steps(10, end) infinite" }}>
          <Sprite id="note" />
        </div>
      )}
    </div>
  );
}

export { ROOM_ITEMS };
