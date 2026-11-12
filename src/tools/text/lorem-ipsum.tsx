"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Segmented } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import { generateLorem, type LoremUnit } from "@/lib/tools/lorem";

const UNITS = [
  { value: "paragraphs", label: "Paragraphs" },
  { value: "sentences", label: "Sentences" },
  { value: "words", label: "Words" },
] as const;

export default function LoremIpsum() {
  const [unit, setUnit] = useState<string>("paragraphs");
  const [count, setCount] = useState("3");
  const [lead, setLead] = useState(true);
  const [seed, setSeed] = useState(0);
  const [text, setText] = useState("");

  // Random text is made after the page loads so it does not clash with the pre-built HTML.
  useEffect(() => {
    let dead = false;
    void Promise.resolve().then(() => {
      if (!dead) setText(generateLorem(unit as LoremUnit, Number(count) || 1, lead));
    });
    return () => {
      dead = true;
    };
  }, [unit, count, lead, seed]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-6">
        <Segmented label="Unit" value={unit} onChange={setUnit} options={UNITS} />
        <ToolField label="How many (1 to 200)" htmlFor="lc">
          <Input id="lc" type="number" min={1} max={200} value={count} onChange={(e) => setCount(e.target.value)} className="w-28" />
        </ToolField>
        <Checkbox label="Start with Lorem ipsum" checked={lead} onCheckedChange={setLead} />
      </div>
      <div className="whitespace-pre-wrap border border-foreground p-4 text-sm leading-relaxed" aria-label="Generated text">
        {text}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setSeed((s) => s + 1)}>
          <RefreshCw aria-hidden /> Generate again
        </Button>
        <CopyButton text={text} label="Copy text" />
      </div>
    </div>
  );
}
