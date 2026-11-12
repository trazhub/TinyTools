import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "error" | "success" | "info" | "warning";

const styles: Record<Tone, string> = {
  error: "border-foreground",
  success: "border-foreground",
  info: "border-foreground",
  warning: "border-foreground",
};
const icons = { error: XCircle, success: CheckCircle2, info: Info, warning: AlertTriangle } as const;

/**
 * Errors use role="alert" (announced immediately); everything else uses
 * role="status" (announced politely). Colour is never the only signal: each
 * tone has its own icon.
 */
export function Alert({
  tone = "info",
  title,
  className,
  children,
}: {
  tone?: Tone;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const Icon = icons[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 border p-3 text-sm", styles[tone], className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="break-words leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
