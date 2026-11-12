"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/form";
import { ToolField } from "@/components/tool/tool-field";
import { MAX_DIFF_LINES, diffLines } from "@/lib/tools/text-tools";

export default function TextDiff() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const parts = useMemo(() => diffLines(a, b), [a, b]);
  const added = parts?.filter((p) => p.type === "add").length ?? 0;
  const removed = parts?.filter((p) => p.type === "del").length ?? 0;
  const hasInput = a !== "" || b !== "";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <ToolField label="Original" htmlFor="da">
          <Textarea id="da" value={a} onChange={(e) => setA(e.target.value)} className="min-h-48 font-mono text-xs" />
        </ToolField>
        <ToolField label="Changed" htmlFor="db">
          <Textarea id="db" value={b} onChange={(e) => setB(e.target.value)} className="min-h-48 font-mono text-xs" />
        </ToolField>
      </div>
      {parts === null && <Alert tone="error">That is too long to compare. The limit is {MAX_DIFF_LINES} lines on each side.</Alert>}
      {parts && hasInput && (
        <div className="space-y-2">
          <p className="text-sm" aria-live="polite">
            {added === 0 && removed === 0 ? "No differences." : `${added} line${added === 1 ? "" : "s"} added, ${removed} removed.`}
          </p>
          <pre className="max-h-[32rem] overflow-auto border border-foreground text-xs leading-relaxed">
            {parts.map((p, i) => (
              <div key={i} className={p.type === "add" ? "bg-foreground text-background" : p.type === "del" ? "bg-muted line-through" : ""}>
                <span aria-hidden className="inline-block w-6 select-none text-center">
                  {p.type === "add" ? "+" : p.type === "del" ? "−" : " "}
                </span>
                <span className="sr-only">{p.type === "add" ? "Added: " : p.type === "del" ? "Removed: " : ""}</span>
                {p.text || " "}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
