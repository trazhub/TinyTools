"use client";

import { useState, useSyncExternalStore } from "react";
import { useElementSize } from "../lib/use-size";
import { useNow } from "../lib/hooks";
import { useStore } from "../lib/store";
import { useKernel, usePrefs, useUI } from "../system/kernel-context";
import { DOCK_HEIGHT, HUD_HEIGHT } from "../layout";
import { runRoomAction } from "./actions";
import { ROOM_ITEMS, fitStage, placedItems, type PlacedItem } from "./layout";
import { RoomStage } from "./room-stage";
import { ScaledStage } from "./scaled-stage";

const ITEMS = placedItems(ROOM_ITEMS);

/** The interactive room, filling the space between the top bar and the bottom strip. */
export function RoomView() {
  const kernel = useKernel();
  const prefs = usePrefs();
  const highlightId = useUI((s) => s.highlightId);
  const effects = useStore(kernel.effects, (e) => e);
  const musicPlaying = useSyncExternalStore(kernel.music.subscribe, kernel.music.isPlaying, () => false);
  const [hotId, setHotId] = useState<string | null>(null);
  const [areaRef, area] = useElementSize();
  const now = useNow(60_000);

  const time = (() => {
    const h = prefs.clock24h ? String(now.getHours()).padStart(2, "0") : String(now.getHours() % 12 || 12);
    return `${h}:${String(now.getMinutes()).padStart(2, "0")}`;
  })();

  const hot: PlacedItem | undefined = ITEMS.find((i) => i.id === hotId);
  const fit = area.w > 0 && area.h > 0 ? fitStage(area.w, area.h) : null;

  return (
    <div ref={areaRef} className="absolute inset-x-0" style={{ top: HUD_HEIGHT, bottom: DOCK_HEIGHT }} data-testid="room-area">
      <ScaledStage width={area.w} height={area.h}>
        {() => (
          <RoomStage
            interactive
            time={time}
            lightsOff={prefs.lightsOff}
            musicPlaying={musicPlaying}
            hotId={hotId}
            highlightId={highlightId}
            effects={effects}
            onHot={setHotId}
            onActivate={(item) => {
              kernel.sfx("click");
              runRoomAction(item as PlacedItem, kernel);
            }}
          />
        )}
      </ScaledStage>

      {/* Hover label, drawn at screen size (not scaled) so it stays readable */}
      {hot?.label && fit && (
        <div
          role="presentation"
          className="px-panel font-pixel pointer-events-none absolute z-[50] -translate-x-1/2 -translate-y-full whitespace-nowrap px-3 py-1 text-[15px] text-foreground"
          style={{ left: fit.x + (hot.x + hot.width / 2) * fit.scale, top: Math.max(8, fit.y + hot.y * fit.scale - 10) }}
        >
          {hot.label}
        </div>
      )}
    </div>
  );
}
