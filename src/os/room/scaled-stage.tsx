"use client";

import type { ReactNode } from "react";
import { fitStage, STAGE_H, STAGE_W, type StageFit } from "./layout";

/** Scales the 320x180 stage to fit `width` x `height`, centred. Children render at native size. */
export function ScaledStage({ width, height, children }: { width: number; height: number; children: (fit: StageFit) => ReactNode }) {
  if (width <= 0 || height <= 0) return null;
  const fit = fitStage(width, height);
  return (
    <div className="absolute" style={{ left: fit.x, top: fit.y, width: fit.width, height: fit.height }}>
      <div style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${fit.scale})`, transformOrigin: "0 0" }}>{children(fit)}</div>
    </div>
  );
}
