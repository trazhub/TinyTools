"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import { contrastRatio, parseColor, toHex, toHsl } from "@/lib/tools/color";

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

export default function ColorConverter() {
  const [input, setInput] = useState("#3b82f6");
  const rgb = useMemo(() => parseColor(input), [input]);
  const rows = rgb
    ? [
        ["HEX", toHex(rgb)],
        ["RGB", `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`],
        ["HSL", (({ h, s, l }) => `hsl(${h}, ${s}%, ${l}%)`)(toHsl(rgb))],
      ]
    : [];
  const onWhite = rgb ? contrastRatio(rgb, WHITE) : 0;
  const onBlack = rgb ? contrastRatio(rgb, BLACK) : 0;

  return (
    <div className="space-y-6">
      <ToolField label="Colour" htmlFor="cc" hint="Type a HEX, rgb() or hsl() value, or pick one.">
        <div className="flex gap-2">
          <Input id="cc" value={input} onChange={(e) => setInput(e.target.value)} className="min-w-0 flex-1" />
          <input
            type="color"
            aria-label="Pick a colour"
            value={rgb ? toHex(rgb) : "#000000"}
            onChange={(e) => setInput(e.target.value)}
            className="h-10 w-14 cursor-pointer border border-foreground bg-background p-1"
          />
        </div>
      </ToolField>
      {input.trim() && !rgb && <Alert tone="error">That colour could not be read. Try #1a2b3c, rgb(26, 43, 60) or hsl(210, 40%, 17%).</Alert>}
      {rgb && (
        <div className="space-y-6">
          <div className="h-24 border border-foreground" style={{ background: toHex(rgb) }} role="img" aria-label={`Colour ${toHex(rgb)}`} />
          <dl className="space-y-3">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center gap-3 border-b border-foreground pb-2">
                <dt className="w-14 text-sm font-medium">{label}</dt>
                <dd className="min-w-0 flex-1 text-sm">{value}</dd>
                <CopyButton text={value ?? ""} label="Copy" size="sm" />
              </div>
            ))}
          </dl>
          <section className="space-y-2">
            <h2 className="text-sm font-medium">Text contrast (WCAG)</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["White text", WHITE, onWhite],
                ["Black text", BLACK, onBlack],
              ].map(([label, fg, ratio]) => (
                <div key={String(label)} className="border border-foreground p-3" style={{ background: toHex(rgb), color: toHex(fg as typeof WHITE) }}>
                  <p className="text-lg">{String(label)}</p>
                  <p className="text-sm">
                    {(ratio as number).toFixed(2)}:1 · {(ratio as number) >= 7 ? "AAA" : (ratio as number) >= 4.5 ? "AA" : (ratio as number) >= 3 ? "Large text only" : "Fails"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
