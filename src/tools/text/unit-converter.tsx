"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import { CATEGORIES, convertUnit, formatNumber } from "@/lib/tools/unit-convert";

const FIRST_TWO = (cat: string) => Object.keys(CATEGORIES[cat]!.units).slice(0, 2) as [string, string];

export default function UnitConverter() {
  const [category, setCategory] = useState("length");
  const [value, setValue] = useState("1");
  const [from, setFrom] = useState("m");
  const [to, setTo] = useState("ft");

  const units = CATEGORIES[category]!.units;
  const converted = value.trim() === "" ? null : convertUnit(category, Number(value), from, to);
  const shown = converted === null ? "" : formatNumber(converted);

  function pickCategory(c: string) {
    const [a, b] = FIRST_TWO(c);
    setCategory(c);
    setFrom(a);
    setTo(b);
  }

  const options = Object.entries(units).map(([id, u]) => (
    <option key={id} value={id}>
      {u.label}
    </option>
  ));

  return (
    <div className="space-y-6">
      <ToolField label="What are you measuring?" htmlFor="uc-cat">
        <Select id="uc-cat" value={category} onChange={(e) => pickCategory(e.target.value)} className="max-w-xs">
          {Object.entries(CATEGORIES).map(([id, c]) => (
            <option key={id} value={id}>
              {c.label}
            </option>
          ))}
        </Select>
      </ToolField>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-3">
          <ToolField label="Value" htmlFor="uc-val">
            <Input id="uc-val" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </ToolField>
          <ToolField label="From" htmlFor="uc-from">
            <Select id="uc-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              {options}
            </Select>
          </ToolField>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Swap the units"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          <ArrowLeftRight aria-hidden />
        </Button>
        <div className="space-y-3">
          <ToolField label="Result" htmlFor="uc-res">
            <Input id="uc-res" readOnly value={shown} />
          </ToolField>
          <ToolField label="To" htmlFor="uc-to">
            <Select id="uc-to" value={to} onChange={(e) => setTo(e.target.value)}>
              {options}
            </Select>
          </ToolField>
        </div>
      </div>
      <CopyButton text={shown} label="Copy result" />
    </div>
  );
}
