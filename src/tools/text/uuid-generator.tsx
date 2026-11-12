"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";

function make(count: number, upper: boolean, dashes: boolean): string {
  return Array.from({ length: count }, () => {
    let id: string = crypto.randomUUID();
    if (!dashes) id = id.replace(/-/g, "");
    return upper ? id.toUpperCase() : id;
  }).join("\n");
}

/** Random version 4 UUIDs from the browser's secure random generator. */
export default function UuidGenerator() {
  const [count, setCount] = useState("5");
  const [upper, setUpper] = useState(false);
  const [dashes, setDashes] = useState(true);
  const [seed, setSeed] = useState(0);
  const [list, setList] = useState("");
  const n = Math.max(1, Math.min(100, Math.floor(Number(count)) || 1));

  // Made after the page loads (random values would not match the pre-built HTML).
  // `seed` changes on "Generate again" so the list is rebuilt even when the options did not change.
  useEffect(() => {
    let dead = false;
    void Promise.resolve().then(() => {
      if (!dead) setList(make(n, upper, dashes));
    });
    return () => {
      dead = true;
    };
  }, [n, upper, dashes, seed]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-6">
        <ToolField label="How many (1 to 100)" htmlFor="uc">
          <Input id="uc" type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} className="w-28" />
        </ToolField>
        <Checkbox label="Uppercase" checked={upper} onCheckedChange={setUpper} />
        <Checkbox label="Dashes" checked={dashes} onCheckedChange={setDashes} />
      </div>
      <pre className="max-h-96 overflow-auto border border-foreground p-3 text-sm" aria-label="Generated UUIDs">
        {list}
      </pre>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setSeed((s) => s + 1)}>
          <RefreshCw aria-hidden /> Generate again
        </Button>
        <CopyButton text={list} label="Copy all" />
      </div>
    </div>
  );
}
