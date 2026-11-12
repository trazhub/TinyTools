"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Textarea } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import { cleanText, convertCase, type CaseKind, type CleanOp } from "@/lib/tools/text-tools";

const CASES: { kind: CaseKind; label: string }[] = [
  { kind: "upper", label: "UPPER CASE" },
  { kind: "lower", label: "lower case" },
  { kind: "title", label: "Title Case" },
  { kind: "sentence", label: "Sentence case" },
  { kind: "camel", label: "camelCase" },
  { kind: "pascal", label: "PascalCase" },
  { kind: "snake", label: "snake_case" },
  { kind: "kebab", label: "kebab-case" },
  { kind: "constant", label: "CONSTANT_CASE" },
];
const CLEAN: { op: CleanOp; label: string }[] = [
  { op: "spaces", label: "Collapse repeated spaces" },
  { op: "trim", label: "Trim each line" },
  { op: "blank", label: "Remove blank lines" },
  { op: "dupes", label: "Remove duplicate lines" },
  { op: "sort", label: "Sort lines A to Z" },
];

export default function CaseConverter() {
  const [text, setText] = useState("");
  const [ops, setOps] = useState<CleanOp[]>([]);

  const toggle = (op: CleanOp, on: boolean) => setOps((l) => (on ? [...l, op] : l.filter((x) => x !== op)));

  return (
    <div className="space-y-6">
      <ToolField label="Your text" htmlFor="ct" action={<Button variant="ghost" size="sm" onClick={() => setText("")} disabled={!text}>Clear</Button>}>
        <Textarea id="ct" value={text} onChange={(e) => setText(e.target.value)} className="min-h-48" placeholder="Type or paste text, then pick a style." />
      </ToolField>
      <div className="space-y-2">
        <p className="text-sm font-medium">Change the case</p>
        <div className="flex flex-wrap gap-2">
          {CASES.map((c) => (
            <Button key={c.kind} variant="outline" size="sm" disabled={!text} onClick={() => setText(convertCase(text, c.kind))}>
              {c.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">Clean up lines</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CLEAN.map((c) => (
            <Checkbox key={c.op} label={c.label} checked={ops.includes(c.op)} onCheckedChange={(v) => toggle(c.op, v)} />
          ))}
        </div>
        <Button variant="outline" size="sm" disabled={!text || ops.length === 0} onClick={() => setText(cleanText(text, ops))}>
          Apply cleanup
        </Button>
      </div>
      <CopyButton text={text} label="Copy text" />
    </div>
  );
}
