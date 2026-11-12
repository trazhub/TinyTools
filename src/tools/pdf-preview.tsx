"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { openPdf } from "./pdf-render";

type Doc = Awaited<ReturnType<typeof openPdf>>;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Shows one page of a PDF. Positions are fractions of the page (0 to 1, from the top left),
 * so they do not depend on screen size. `children` are drawn on top, positioned in percent.
 * Click reports a point; dragging reports a rectangle.
 */
export function PagePreview({
  doc,
  pageNumber,
  onPoint,
  onRect,
  children,
}: {
  doc: Doc;
  pageNumber: number;
  onPoint?: (p: { x: number; y: number }) => void;
  onRect?: (r: Rect) => void;
  children?: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1.4);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  useEffect(() => {
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let dead = false;
    (async () => {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1000 / base.width) });
      const c = canvas.current;
      if (!c || dead) return;
      c.width = viewport.width;
      c.height = viewport.height;
      setAspect(base.height / base.width);
      task = page.render({ canvas: c, viewport });
      await task.promise.catch(() => {});
    })();
    return () => {
      dead = true;
      task?.cancel();
    };
  }, [doc, pageNumber]);

  const frac = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  function down(e: React.PointerEvent) {
    if (!onPoint && !onRect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = frac(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }
  function move(e: React.PointerEvent) {
    if (!drag) return;
    const p = frac(e);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  }
  function up() {
    if (!drag) return;
    const r = { x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0) };
    setDrag(null);
    if (onRect && r.w > 0.01 && r.h > 0.01) onRect(r);
    else if (onPoint) onPoint({ x: drag.x1, y: drag.y1 });
  }

  return (
    <div
      ref={box}
      className="relative w-full touch-none select-none border border-foreground bg-muted"
      style={{ aspectRatio: `1 / ${aspect}`, containerType: "inline-size", cursor: onPoint || onRect ? "crosshair" : "default" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full bg-white" />
      {children}
      {drag && onRect && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-foreground bg-black/20"
          style={{ left: `${Math.min(drag.x0, drag.x1) * 100}%`, top: `${Math.min(drag.y0, drag.y1) * 100}%`, width: `${Math.abs(drag.x1 - drag.x0) * 100}%`, height: `${Math.abs(drag.y1 - drag.y0) * 100}%` }}
        />
      )}
    </div>
  );
}

/** Previous / next page buttons row. */
export function PageNav({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <button type="button" className="border border-foreground px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {total}
      </span>
      <button type="button" className="border border-foreground px-3 py-1 disabled:opacity-40" disabled={page >= total} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}
