"use client";

import { useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PixelIcon } from "../../pixel/pixel-context";
import { useKernel, usePrefs } from "../../system/kernel-context";
import { cn } from "@/lib/utils";

/** The record player: a generative lo-fi loop made on the spot with Web Audio. */
export default function MusicApp() {
  const kernel = useKernel();
  const prefs = usePrefs();
  const playing = useSyncExternalStore(kernel.music.subscribe, kernel.music.isPlaying, () => false);

  const toggle = () => {
    if (playing) {
      kernel.music.stop();
      return;
    }
    // Pressing play is a clear request for sound, so turn it on if it was muted.
    if (!prefs.sound) kernel.prefs.set({ sound: true });
    kernel.music.start();
    if (!kernel.music.isPlaying()) kernel.notify({ tone: "warning", message: "Your browser couldn't start audio. Try clicking again." });
  };

  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 p-6 text-center" data-testid="music">
      <div className="px-frame bg-[var(--px-title)] p-4">
        <PixelIcon id="recordPlayer" scale={5} />
      </div>
      <div>
        <h2 className="font-pixel text-[24px] font-bold">Lo-fi, made up as it goes</h2>
        <p className="mt-1 text-sm text-muted-foreground">Slow chords in A minor with a wandering melody. It never repeats exactly, and it is all generated in your browser.</p>
      </div>

      <div className="flex items-end gap-1" aria-hidden>
        {[3, 6, 4, 8, 5, 7, 3].map((h, i) => (
          <span
            key={i}
            className={cn("w-3 bg-primary", playing && "[animation:px-bounce_0.6s_steps(1,end)_infinite]")}
            style={{ height: h * 3, animationDelay: `${i * 0.11}s` }}
          />
        ))}
      </div>

      <Button size="lg" onClick={toggle} aria-pressed={playing} data-testid="music-toggle">
        {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
        {playing ? "Pause" : "Play"}
      </Button>

      <label className="grid w-full max-w-xs gap-1 text-left text-sm font-medium">
        Volume
        <input
          type="range"
          className="range"
          min={0}
          max={100}
          value={Math.round(prefs.musicVolume * 100)}
          onChange={(e) => kernel.prefs.set({ musicVolume: Number(e.target.value) / 100 })}
          aria-valuetext={`${Math.round(prefs.musicVolume * 100)} percent`}
        />
      </label>

      <p className="text-xs text-muted-foreground" role="status">
        {playing ? "Playing. The speaker button in the top bar mutes everything." : prefs.sound ? "Press play to start." : "Sound is off. Pressing play turns it on."}
      </p>
    </div>
  );
}
