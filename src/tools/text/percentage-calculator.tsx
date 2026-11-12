"use client";

import { useState } from "react";
import { Input } from "@/components/ui/form";
import { ToolField } from "@/components/tool/tool-field";
import { formatNumber } from "@/lib/tools/unit-convert";
import { pctChange, pctOf, whatPercent } from "@/lib/tools/calc-tools";

function Row({ title, children, answer }: { title: string; children: React.ReactNode; answer: string }) {
  return (
    <section className="space-y-3 border border-foreground p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      <p className="text-lg" aria-live="polite">
        {answer || "–"}
      </p>
    </section>
  );
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const show = (n: number, suffix = "") => (Number.isFinite(n) ? formatNumber(Math.round(n * 1e6) / 1e6) + suffix : "");

export default function PercentageCalculator() {
  const [a1, setA1] = useState("15");
  const [b1, setB1] = useState("200");
  const [a2, setA2] = useState("50");
  const [b2, setB2] = useState("200");
  const [a3, setA3] = useState("100");
  const [b3, setB3] = useState("150");

  return (
    <div className="space-y-5">
      <Row title="What is X% of Y?" answer={show(pctOf(num(a1), num(b1)))}>
        <ToolField label="X (%)" htmlFor="p1a">
          <Input id="p1a" type="number" value={a1} onChange={(e) => setA1(e.target.value)} className="w-28" />
        </ToolField>
        <ToolField label="Y" htmlFor="p1b">
          <Input id="p1b" type="number" value={b1} onChange={(e) => setB1(e.target.value)} className="w-28" />
        </ToolField>
      </Row>
      <Row title="X is what percent of Y?" answer={show(whatPercent(num(a2), num(b2)), "%")}>
        <ToolField label="X" htmlFor="p2a">
          <Input id="p2a" type="number" value={a2} onChange={(e) => setA2(e.target.value)} className="w-28" />
        </ToolField>
        <ToolField label="Y" htmlFor="p2b">
          <Input id="p2b" type="number" value={b2} onChange={(e) => setB2(e.target.value)} className="w-28" />
        </ToolField>
      </Row>
      <Row title="Percentage change from X to Y" answer={show(pctChange(num(a3), num(b3)), "%")}>
        <ToolField label="From X" htmlFor="p3a">
          <Input id="p3a" type="number" value={a3} onChange={(e) => setA3(e.target.value)} className="w-28" />
        </ToolField>
        <ToolField label="To Y" htmlFor="p3b">
          <Input id="p3b" type="number" value={b3} onChange={(e) => setB3(e.target.value)} className="w-28" />
        </ToolField>
      </Row>
    </div>
  );
}
