"use client";

import { Fragment, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Input, Textarea } from "@/components/ui/form";
import { ToolField } from "@/components/tool/tool-field";
import { runRegex } from "@/lib/tools/regex-tools";

export default function RegexTester() {
  const [pattern, setPattern] = useState("(\\w+)@(\\w+)\\.com");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("Mail alice@example.com or bob@test.com today.");
  const result = useMemo(() => runRegex(pattern, flags, text), [pattern, flags, text]);

  // The text, split into plain and matched pieces so matches can be highlighted.
  const pieces = useMemo(() => {
    if (!result.ok) return [];
    const out: { text: string; hit: boolean }[] = [];
    let pos = 0;
    for (const m of result.matches) {
      if (m.text === "") continue;
      if (m.index > pos) out.push({ text: text.slice(pos, m.index), hit: false });
      out.push({ text: m.text, hit: true });
      pos = m.index + m.text.length;
    }
    if (pos < text.length) out.push({ text: text.slice(pos), hit: false });
    return out;
  }, [result, text]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <ToolField label="Pattern" htmlFor="rx" className="min-w-0 flex-1">
          <Input id="rx" value={pattern} onChange={(e) => setPattern(e.target.value)} className="font-mono" spellCheck={false} />
        </ToolField>
        <ToolField label="Flags" htmlFor="rxf" hint="g i m s u y">
          <Input id="rxf" value={flags} onChange={(e) => setFlags(e.target.value)} className="w-28 font-mono" spellCheck={false} />
        </ToolField>
      </div>
      <ToolField label="Text to search" htmlFor="rxt">
        <Textarea id="rxt" value={text} onChange={(e) => setText(e.target.value)} className="min-h-32 font-mono text-sm" />
      </ToolField>
      {!result.ok && <Alert tone="error">{result.error}</Alert>}
      {result.ok && pattern && (
        <div className="space-y-4">
          <p className="text-sm" aria-live="polite">
            {result.matches.length} match{result.matches.length === 1 ? "" : "es"}
            {result.truncated ? " (showing the first 1000)" : ""}
          </p>
          <pre className="whitespace-pre-wrap break-words border border-foreground p-3 text-sm">
            {pieces.map((p, i) => (p.hit ? <mark key={i} className="bg-foreground text-background">{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>))}
          </pre>
          {result.matches.length > 0 && (
            <table className="w-full border border-foreground text-sm">
              <thead>
                <tr className="border-b border-foreground text-left">
                  <th className="p-2">#</th>
                  <th className="p-2">Match</th>
                  <th className="p-2">At</th>
                  <th className="p-2">Groups</th>
                </tr>
              </thead>
              <tbody>
                {result.matches.slice(0, 100).map((m, i) => (
                  <tr key={i} className="border-b border-foreground last:border-0">
                    <td className="p-2">{i + 1}</td>
                    <td className="break-all p-2 font-mono">{m.text || "(empty)"}</td>
                    <td className="p-2">{m.index}</td>
                    <td className="break-all p-2 font-mono">{m.groups.map((g) => g ?? "–").join(" | ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
