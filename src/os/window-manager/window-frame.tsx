"use client";

import { memo, Suspense, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Copy, Loader2, Minus, Square, X } from "lucide-react";
import { AppIcon } from "../apps/app-icon";
import { useKernel, useUI, useWM } from "../system/kernel-context";
import { cn } from "@/lib/utils";
import { AppErrorBoundary } from "./app-error-boundary";
import { computeResize, type Rect, type ResizeDir } from "./geometry";

const HANDLES: { dir: ResizeDir; className: string; cursor: string }[] = [
  { dir: "n", className: "inset-x-3 -top-1 h-2", cursor: "ns-resize" },
  { dir: "s", className: "inset-x-3 -bottom-1 h-2", cursor: "ns-resize" },
  { dir: "e", className: "inset-y-3 -right-1 w-2", cursor: "ew-resize" },
  { dir: "w", className: "inset-y-3 -left-1 w-2", cursor: "ew-resize" },
  { dir: "ne", className: "-right-1 -top-1 size-4", cursor: "nesw-resize" },
  { dir: "nw", className: "-left-1 -top-1 size-4", cursor: "nwse-resize" },
  { dir: "se", className: "-bottom-1 -right-1 size-4", cursor: "nwse-resize" },
  { dir: "sw", className: "-bottom-1 -left-1 size-4", cursor: "nesw-resize" },
];

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startRect: Rect;
  /** Where along the (maximized) title bar the user grabbed, so the window tears off under the pointer. */
  grabRatio: number;
  wasMaximized: boolean;
}

export const WindowFrame = memo(function WindowFrame({ id }: { id: string }) {
  const kernel = useKernel();
  const win = useWM((s) => s.windows.find((w) => w.id === id));
  const focused = useWM((s) => s.focusedId === id);
  const workArea = useWM((s) => s.workArea);
  const mobile = useUI((s) => s.mobile);

  const [interacting, setInteracting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);

  const dispatch = kernel.wm.dispatch;
  const minimized = win?.minimized ?? false;

  // Move real keyboard focus into a window when it becomes the active one (e.g. from the taskbar).
  useEffect(() => {
    const root = rootRef.current;
    if (focused && !minimized && root && !root.contains(document.activeElement)) root.focus({ preventScroll: true });
  }, [focused, minimized]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const scheduleMove = useCallback(
    (x: number, y: number) => {
      pending.current = { x, y };
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const p = pending.current;
        if (p) dispatch({ type: "move", id, x: p.x, y: p.y });
      });
    },
    [dispatch, id],
  );

  if (!win) return null;
  const app = kernel.getApp(win.appId);
  if (!app) return null;

  const rect: Rect = mobile || win.maximized ? workArea : win.rect;
  const hidden = win.minimized || (mobile && !focused);

  // ---- dragging by the title bar ------------------------------------------
  const onTitleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mobile || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startRect: win.rect,
      grabRatio: workArea.width > 0 ? (e.clientX - workArea.x) / workArea.width : 0.5,
      wasMaximized: win.maximized,
    };
    setInteracting(true);
  };

  const onTitleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.wasMaximized) {
      if (Math.abs(dx) + Math.abs(dy) < 4) return;
      // Tear the window off the maximized state, keeping the pointer at the same relative spot.
      const x = e.clientX - d.startRect.width * d.grabRatio;
      const y = e.clientY - 20;
      d.wasMaximized = false;
      d.startRect = { ...d.startRect, x, y };
      d.startX = e.clientX;
      d.startY = e.clientY;
      scheduleMove(x, y);
      return;
    }
    scheduleMove(d.startRect.x + dx, d.startRect.y + dy);
  };

  const endDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if (drag.current && drag.current.pointerId === e.pointerId) {
      drag.current = null;
      setInteracting(false);
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // ---- resizing from the edges and corners ---------------------------------
  const startResize = (dir: ResizeDir) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const startRect = win.rect;
    const startX = e.clientX;
    const startY = e.clientY;
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    setInteracting(true);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      dispatch({ type: "resize", id, rect: computeResize(startRect, dir, ev.clientX - startX, ev.clientY - startY, win.minSize, workArea) });
    };
    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("pointercancel", onEnd);
      setInteracting(false);
    };
    // Listeners live on the captured element, so they are released with it.
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onEnd);
    el.addEventListener("pointercancel", onEnd);
  };

  const close = () => kernel.closeWindow(id);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={win.title}
      aria-modal="false"
      tabIndex={-1}
      data-window-id={id}
      data-app-id={win.appId}
      data-focused={focused}
      data-minimized={hidden}
      data-maximized={win.maximized}
      data-interacting={interacting}
      inert={hidden}
      onPointerDownCapture={() => dispatch({ type: "focus", id })}
      className={cn("wm-window px-window pointer-events-auto absolute flex animate-window-in flex-col outline-none", mobile && "!shadow-none")}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex: win.z }}
    >
      <div
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => {
          if (!mobile && win.resizable && !(e.target as HTMLElement).closest("button")) dispatch({ type: "toggleMaximize", id });
        }}
        className={cn(
          "os-chrome relative flex shrink-0 touch-none items-center gap-2 border-b-4 border-[var(--px-bd)] pl-3",
          mobile ? "h-12" : "h-10",
          focused ? "bg-titlebar" : "bg-[var(--px-title-inactive)]",
        )}
        data-testid="titlebar"
      >
        <AppIcon app={app} size={20} />
        <span className={cn("font-pixel min-w-0 flex-1 truncate text-[16px] font-semibold", focused ? "text-foreground" : "text-muted-foreground")}>
          {win.title}
        </span>
        <div className="flex items-center gap-2 pr-2">
          <ControlButton label="Minimize" onClick={() => dispatch({ type: "minimize", id })}>
            <Minus className="size-4" aria-hidden />
          </ControlButton>
          {!mobile && win.resizable && (
            <ControlButton label={win.maximized ? "Restore" : "Maximize"} onClick={() => dispatch({ type: "toggleMaximize", id })}>
              {win.maximized ? <Copy className="size-3.5 -scale-x-100" aria-hidden /> : <Square className="size-3.5" aria-hidden />}
            </ControlButton>
          )}
          <ControlButton label="Close" danger onClick={close}>
            <X className="size-4" aria-hidden />
          </ControlButton>
        </div>
      </div>

      <div className={cn("relative min-h-0 flex-1 overflow-auto bg-background", interacting && "pointer-events-none")}>
        <AppErrorBoundary appName={app.name} onClose={close}>
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-muted-foreground" role="status">
                <Loader2 className="size-6 animate-spin" aria-label={`Loading ${app.name}`} />
              </div>
            }
          >
            <app.component windowId={id} props={win.props} />
          </Suspense>
        </AppErrorBoundary>
      </div>

      {!mobile && win.resizable && !win.maximized &&
        HANDLES.map((h) => (
          <div
            key={h.dir}
            data-resize={h.dir}
            aria-hidden
            onPointerDown={startResize(h.dir)}
            className={cn("absolute z-10 touch-none", h.className)}
            style={{ cursor: h.cursor }}
          />
        ))}
    </div>
  );
});

function ControlButton({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("px-btn grid size-7 place-items-center", danger && "[--px-btn:var(--destructive)] [--px-btn-hi:color-mix(in_oklab,var(--destructive),white_40%)] [--px-btn-lo:color-mix(in_oklab,var(--destructive),black_35%)]")}
    >
      {children}
    </button>
  );
}
