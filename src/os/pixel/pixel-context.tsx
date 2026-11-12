"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Palette } from "./canvas";
import { buildPalette, findTheme, type RoomTheme } from "./palette";
import { spriteSize, spriteUrl, type SpriteId } from "./registry";

interface PixelContextValue {
  palette: Palette;
  paletteId: string;
  theme: RoomTheme;
}

const PixelContext = createContext<PixelContextValue | null>(null);

export function PixelProvider({ themeId, hoodieId, children }: { themeId: string; hoodieId: string; children: ReactNode }) {
  const value = useMemo(() => ({ palette: buildPalette(themeId, hoodieId), paletteId: `${themeId}|${hoodieId}`, theme: findTheme(themeId) }), [themeId, hoodieId]);
  return <PixelContext.Provider value={value}>{children}</PixelContext.Provider>;
}

export function usePixel(): PixelContextValue {
  const ctx = useContext(PixelContext);
  if (!ctx) throw new Error("usePixel must be used inside <PixelProvider>");
  return ctx;
}

/** Image source for a sprite in the current theme. */
export function useSpriteUrl(id: SpriteId, variant = ""): string {
  const { palette, paletteId } = usePixel();
  return spriteUrl(id, variant, palette, paletteId);
}

/** A sprite scaled up by a whole number: for interface icons and portraits outside the room stage. */
export function PixelIcon({ id, scale = 3, variant = "", className }: { id: SpriteId; scale?: number; variant?: string; className?: string }) {
  const src = useSpriteUrl(id, variant);
  const { width, height } = spriteSize(id, variant);
  // eslint-disable-next-line @next/next/no-img-element -- generated data-URL art; next/image does not apply
  return <img src={src} alt="" draggable={false} className={`px-art ${className ?? ""}`} style={{ width: width * scale, height: height * scale }} />;
}

/** A sprite as an <img>. Size is in art pixels; the stage's scale makes it chunky. */
export function Sprite({ id, variant = "", className }: { id: SpriteId; variant?: string; className?: string }) {
  const src = useSpriteUrl(id, variant);
  // eslint-disable-next-line @next/next/no-img-element -- generated data-URL art; next/image does not apply
  return <img src={src} alt="" draggable={false} className={`px-art ${className ?? ""}`} />;
}
