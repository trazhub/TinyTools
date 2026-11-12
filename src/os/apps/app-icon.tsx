import { cn } from "@/lib/utils";
import type { AppDefinition } from "./types";

/**
 * An app's icon: a flat, hard-edged tile with a pixel outline and a lit top edge,
 * tinted from the app's hue, with the app's glyph in cream.
 */
export function AppIcon({ app, size = 40, className }: { app: Pick<AppDefinition, "icon" | "hue">; size?: number; className?: string }) {
  const Icon = app.icon;
  const base = `oklch(0.66 0.15 ${app.hue})`;
  const light = `oklch(0.8 0.12 ${app.hue})`;
  const dark = `oklch(0.46 0.15 ${app.hue})`;
  return (
    <span
      aria-hidden
      className={cn("inline-grid shrink-0 place-items-center", className)}
      style={{
        width: size,
        height: size,
        background: base,
        color: "#fff7e0",
        boxShadow: `0 -2px 0 0 #070618, 0 2px 0 0 #070618, -2px 0 0 0 #070618, 2px 0 0 0 #070618, inset 0 2px 0 0 ${light}, inset 0 -4px 0 0 ${dark}`,
      }}
    >
      <Icon style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.5} />
    </span>
  );
}
