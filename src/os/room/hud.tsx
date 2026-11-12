"use client";

import { PixelIcon } from "../pixel/pixel-context";
import { HUD_HEIGHT } from "../layout";
import { useKernel, usePrefs } from "../system/kernel-context";
import { cn } from "@/lib/utils";

/** The three buttons from the title screen, always available: leave the room, sound, settings. */
export function Hud({ onLeave }: { onLeave: () => void }) {
  const kernel = useKernel();
  const prefs = usePrefs();

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[9000] flex items-center justify-center" style={{ height: HUD_HEIGHT }}>
      <nav aria-label="Room controls" className="pointer-events-auto flex gap-4">
        <HudButton label="Leave the room and return to the title screen" onClick={onLeave}>
          <PixelIcon id="iconHome" scale={3} />
        </HudButton>
        <HudButton
          label={prefs.sound ? "Sound is on. Press to mute" : "Sound is off. Press to turn on"}
          pressed={prefs.sound}
          onClick={() => {
            const next = !prefs.sound;
            kernel.prefs.set({ sound: next });
            // Play the confirmation after the preference changes, so turning sound ON is audible.
            if (next) kernel.sfx("select");
          }}
        >
          <PixelIcon id={prefs.sound ? "iconSoundOn" : "iconSoundOff"} scale={3} />
        </HudButton>
        <HudButton label="Settings" onClick={() => kernel.openApp("settings")}>
          <PixelIcon id="iconGear" scale={3} />
        </HudButton>
      </nav>
    </div>
  );
}

function HudButton({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...(pressed !== undefined ? { "aria-pressed": pressed } : {})}
      onClick={onClick}
      className={cn("px-btn grid size-[52px] place-items-center")}
    >
      {children}
    </button>
  );
}
