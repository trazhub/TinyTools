"use client";

import { useEffect, useRef } from "react";
import { useElementSize } from "../lib/use-size";
import { useNow } from "../lib/hooks";
import { PixelIcon } from "../pixel/pixel-context";
import { usePrefs, useKernel } from "../system/kernel-context";
import { OS_TAGLINE } from "../version";
import { RoomStage } from "./room-stage";
import { ScaledStage } from "./scaled-stage";

/** Shown while the OS starts, and as the static page before JavaScript runs. */
export function BootScreen({ message = "Loading your room…" }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-[#070618] text-[#f3e9d0]" data-testid="boot-screen">
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <PixelIcon id="logoStar" scale={5} />
        <h1 className="font-pixel text-4xl font-bold tracking-wide">TinyTools OS</h1>
        <div className="h-3 w-48 border-2 border-[#5d82dc] p-0.5" aria-hidden>
          <div className="h-full w-1/3 bg-[#ffc866] [animation:boot-bar_1s_steps(6,end)_infinite]" />
        </div>
        <p role="status" className="font-pixel text-base text-[#a395ee]">
          {message}
        </p>
      </div>
    </div>
  );
}

/** The front door: logo, tagline, a peek into the room, and a big ENTER ROOM button. */
export function TitleScreen({ returning, onEnter, onOpenSettings }: { returning: boolean; onEnter: () => void; onOpenSettings: () => void }) {
  const kernel = useKernel();
  const prefs = usePrefs();
  const [frameRef, frame] = useElementSize();
  const enter = useRef<HTMLButtonElement>(null);
  const now = useNow(60_000);
  const time = `${prefs.clock24h ? String(now.getHours()).padStart(2, "0") : String(now.getHours() % 12 || 12)}:${String(now.getMinutes()).padStart(2, "0")}`;

  useEffect(() => enter.current?.focus({ preventScroll: true }), []);

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[var(--px-stage-bg)] text-foreground" data-testid="title-screen">
      <div className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col items-center justify-center gap-6 px-6 py-6 lg:flex-row lg:gap-10 lg:py-4">
        {/* Controls */}
        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 gap-4">
          <button
            type="button"
            className="px-btn grid size-[52px] place-items-center"
            aria-pressed={prefs.sound}
            aria-label={prefs.sound ? "Sound is on. Press to mute" : "Sound is off. Press to turn on"}
            onClick={() => {
              kernel.prefs.set({ sound: !prefs.sound });
              if (!prefs.sound) kernel.sfx("select");
            }}
          >
            <PixelIcon id={prefs.sound ? "iconSoundOn" : "iconSoundOff"} scale={3} />
          </button>
          <button type="button" className="px-btn grid size-[52px] place-items-center" aria-label="Open settings" onClick={onOpenSettings}>
            <PixelIcon id="iconGear" scale={3} />
          </button>
        </div>

        {/* Logo */}
        <header className="mt-16 text-center lg:mt-0 lg:w-[34%] lg:shrink-0">
          <h1 className="font-pixel leading-none">
            <span
              className="block text-[clamp(44px,7vw,92px)] font-bold tracking-tight text-[#f7edd3]"
              style={{ textShadow: "0 4px 0 #8a6a3c, 4px 4px 0 #1a1440, -2px 0 0 #1a1440, 2px 0 0 #1a1440, 0 -2px 0 #1a1440" }}
            >
              TinyTools
            </span>
            <span className="mt-2 flex items-center justify-center gap-3">
              <PixelIcon id="logoStar" scale={3} className="hidden sm:block" />
              <span
                className="block text-[clamp(56px,9vw,120px)] font-bold text-[#5d82dc]"
                style={{ textShadow: "0 5px 0 #2b2680, 5px 5px 0 #070618, -2px 0 0 #070618, 2px 0 0 #070618, 0 -2px 0 #070618" }}
              >
                OS
              </span>
              <PixelIcon id="logoStar" scale={3} className="hidden sm:block" />
            </span>
          </h1>
          <p className="font-pixel mt-5 text-[clamp(18px,2.2vw,28px)] leading-snug text-[#a395ee]">{OS_TAGLINE.toLowerCase().replace(". anywhere", ",\nanywhere")}</p>
        </header>

        {/* The room, with the welcome dialogue and the ENTER ROOM button */}
        <div className="relative w-full max-w-[1000px] flex-1 pb-8 lg:pb-10">
          <div ref={frameRef} className="px-frame relative aspect-[16/9] w-full overflow-hidden bg-black">
            <ScaledStage width={frame.w} height={frame.h}>
              {() => <RoomStage interactive={false} time={time} lightsOff={prefs.lightsOff} musicPlaying={false} hotId={null} highlightId={null} effects={[]} onHot={() => undefined} onActivate={() => undefined} />}
            </ScaledStage>
          </div>

          <div className="px-panel absolute inset-x-[4%] bottom-0 flex items-center gap-4 bg-[var(--background)] p-3 sm:p-4" style={{ background: "var(--background)" }}>
            <div className="px-frame hidden size-[72px] shrink-0 place-items-center bg-[var(--px-title)] sm:grid" aria-hidden>
              <PixelIcon id="portrait" scale={2} />
            </div>
            <p className="font-pixel min-w-0 flex-1 text-[clamp(16px,1.8vw,22px)] leading-snug">
              {returning ? "Welcome back!" : "Welcome!"}
              <br />
              {returning ? "What would you like to explore?" : "This is your little computer."}
            </p>
            <button
              ref={enter}
              type="button"
              onClick={onEnter}
              className="px-btn font-pixel h-12 shrink-0 px-5 text-[clamp(16px,1.8vw,22px)] font-bold tracking-wide"
            >
              ENTER ROOM &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
