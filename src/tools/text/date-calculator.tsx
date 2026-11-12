"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/form";
import { ToolField } from "@/components/tool/tool-field";
import { dateDiff, parseDay } from "@/lib/tools/calc-tools";

/** Time between two dates. With only a birth date, the second date is today, which gives an age. */
export default function DateCalculator() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const a = from ? parseDay(from) : null;
  // Empty "to" means today (by the visitor's calendar).
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const b = to ? parseDay(to) : todayUtc;
  const diff = a && b ? dateDiff(a, b) : null;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <ToolField label="From (or birth date)" htmlFor="df">
          <Input id="df" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-48" />
        </ToolField>
        <ToolField label="To (empty means today)" htmlFor="dt">
          <Input id="dt" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-48" />
        </ToolField>
      </div>
      {from && !a && <Alert tone="error">The first date is not valid.</Alert>}
      {diff && (
        <div className="space-y-2 border border-foreground p-4" aria-live="polite">
          <p className="text-lg">
            {plural(diff.years, "year")}, {plural(diff.months, "month")}, {plural(diff.days, "day")}
          </p>
          <p className="text-sm text-muted-foreground">
            {diff.totalDays.toLocaleString()} days in total, about {Math.floor(diff.totalDays / 7).toLocaleString()} weeks
          </p>
        </div>
      )}
    </div>
  );
}
