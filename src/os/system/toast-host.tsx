"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from "lucide-react";
import { HUD_HEIGHT } from "../layout";
import { useStore } from "../lib/store";
import { useKernel, useUI } from "./kernel-context";
import type { Toast, ToastTone } from "./notifications";
import { cn } from "@/lib/utils";

const ICONS: Record<ToastTone, { icon: LucideIcon; tone: string }> = {
  info: { icon: Info, tone: "text-primary" },
  success: { icon: CheckCircle2, tone: "text-success" },
  warning: { icon: AlertTriangle, tone: "text-warning" },
  error: { icon: XCircle, tone: "text-destructive" },
};

export function ToastHost() {
  const kernel = useKernel();
  const toasts = useStore(kernel.toasts.state, (s) => s);
  const mobile = useUI((s) => s.mobile);

  const style = mobile ? { left: 16, right: 16, top: HUD_HEIGHT + 8 } : { right: 20, top: HUD_HEIGHT + 8 };

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none absolute z-[9800] flex w-auto flex-col gap-2 sm:w-[360px]"
      style={style}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const kernel = useKernel();
  const [paused, setPaused] = useState(false);
  const { icon: Icon, tone } = ICONS[toast.tone];

  useEffect(() => {
    if (toast.duration <= 0 || paused) return;
    const timer = setTimeout(() => kernel.toasts.dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [kernel, toast.id, toast.duration, paused]);

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      data-testid="toast"
      data-tone={toast.tone}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="px-panel os-chrome pointer-events-auto flex animate-toast-in items-start gap-3 rounded-xl p-3"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-[13px] font-semibold">{toast.title}</p>}
        <p className="break-words text-[13px] leading-snug text-foreground/85">{toast.message}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => kernel.toasts.dismiss(toast.id)}
        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
