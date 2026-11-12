"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import { parseStamp } from "@/lib/tools/calc-tools";

export default function TimestampConverter() {
  const [input, setInput] = useState("");
  const stamp = useMemo(() => parseStamp(input), [input]);
  const rows = stamp
    ? [
        ["UTC (ISO 8601)", stamp.iso],
        ["Your time zone", new Date(stamp.millis).toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" })],
        ["Unix seconds", String(stamp.seconds)],
        ["Unix milliseconds", String(stamp.millis)],
      ]
    : [];

  return (
    <div className="space-y-6">
      <ToolField label="Timestamp or date" htmlFor="ts" hint="Try 1700000000, 1700000000000 or 2023-11-14T22:13:20Z.">
        <div className="flex flex-wrap gap-2">
          <Input id="ts" value={input} onChange={(e) => setInput(e.target.value)} className="min-w-0 flex-1" />
          <Button variant="outline" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>
            Now
          </Button>
        </div>
      </ToolField>
      {input.trim() && !stamp && <Alert tone="error">That is not a timestamp or date this tool can read.</Alert>}
      {stamp && (
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-center gap-2 border-b border-foreground pb-2">
              <dt className="w-44 text-sm font-medium">{label}</dt>
              <dd className="min-w-0 flex-1 break-all text-sm">{value}</dd>
              <CopyButton text={value ?? ""} label="Copy" size="sm" />
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
