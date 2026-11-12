"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Segmented } from "@/components/ui/form";
import { useNow, useReducedMotion } from "../../lib/hooks";
import { useKernel, usePrefs } from "../../system/kernel-context";
import { startAmbientSound } from "./ambient-audio";
import { SCENES, SCENE_H, SCENE_W, createScene, drawScene, stepScene, type SceneKind } from "./scenes";

/** What you see through the window: a living pixel scene, with its own gentle sound if you like. */
export default function AmbientApp() {
  const kernel = useKernel();
  const prefs = usePrefs();
  const reduced = useReducedMotion(prefs.motion);
  const [kind, setKind] = useState<SceneKind>("city");
  const [soundOn, setSoundOn] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const now = useNow(60_000);
  const info = SCENES.find((s) => s.id === kind)!;

  // Run the scene. With reduced motion we draw a single settled frame instead of animating.
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const scene = createScene(kind, Math.random);
    for (let i = 0; i < 90; i++) stepScene(scene, 1 / 30, Math.random);
    if (reduced) {
      drawScene(ctx, scene);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const loop = (nowMs: number) => {
      stepScene(scene, (nowMs - last) / 1000, Math.random);
      last = nowMs;
      drawScene(ctx, scene);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [kind, reduced]);

  // Ambient sound follows the scene, the local switch and the master sound setting.
  const wantSound = soundOn && prefs.sound && info.sound !== null;
  useEffect(() => {
    if (!wantSound || !info.sound) return;
    const ctx = kernel.sound.context();
    if (!ctx) return;
    void ctx.resume().catch(() => undefined);
    return startAmbientSound(ctx, info.sound, 0.5 * prefs.musicVolume + 0.1);
  }, [wantSound, info.sound, kernel, prefs.musicVolume]);

  const clock = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: !prefs.clock24h });
  const date = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex h-full flex-col gap-3 p-4" data-testid="ambient">
      <div className="relative min-h-0 flex-1">
        <div className="mx-auto flex h-full max-w-[960px] items-center">
          <div className="relative w-full border-4 border-[var(--px-bd)]">
            <canvas
              ref={canvas}
              width={SCENE_W}
              height={SCENE_H}
              role="img"
              aria-label={`${info.name}: ${info.blurb}`}
              className="block w-full [image-rendering:pixelated]"
              style={{ aspectRatio: `${SCENE_W} / ${SCENE_H}` }}
            />
            <div className="pointer-events-none absolute bottom-3 left-4 text-[#f7edd3]" style={{ textShadow: "2px 2px 0 #070618" }}>
              <p className="font-pixel text-[clamp(22px,4vw,44px)] font-bold leading-none">{clock}</p>
              <p className="font-pixel text-[clamp(13px,1.6vw,18px)]">{date}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<SceneKind> label="Scene" value={kind} onChange={setKind} options={SCENES.map((s) => ({ value: s.id, label: s.name }))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soundOn} disabled={info.sound === null} onChange={(e) => setSoundOn(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          {soundOn && prefs.sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
          Ambient sound
        </label>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {info.blurb}
        {info.sound === null ? " This scene is silent." : !prefs.sound ? " Turn sound on with the speaker button to hear it." : ""}
        {reduced ? " Animation is reduced, so this is a still image." : ""}
      </p>
    </div>
  );
}
