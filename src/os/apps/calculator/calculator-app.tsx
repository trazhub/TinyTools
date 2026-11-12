"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Delete, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { evaluate, formatResult } from "./calc";
import {
  actionForKey,
  appendCloseParen,
  appendDecimal,
  appendDigit,
  appendOpenParen,
  appendOperator,
  appendPercent,
  backspace,
  toggleSign,
  type KeyAction,
} from "./keypad";

interface HistoryEntry {
  expression: string;
  result: string;
}

const MAX_HISTORY = 20;

export default function CalculatorApp() {
  const [expr, setExpr] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** True right after "=", so the next digit starts a fresh calculation. */
  const [fresh, setFresh] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const live = expr ? evaluate(expr) : null;
  const preview = live?.ok ? formatResult(live.value) : null;

  function apply(action: KeyAction | { type: "sign" }) {
    setError(null);
    // Typing a number after a result starts over; typing an operator continues from the result.
    const base = fresh && (action.type === "digit" || action.type === "decimal" || action.type === "open") ? "" : expr;
    if (action.type !== "equals") setFresh(false);

    switch (action.type) {
      case "digit":
        return setExpr(appendDigit(base, action.value));
      case "decimal":
        return setExpr(appendDecimal(base));
      case "operator":
        return setExpr(appendOperator(base, action.value));
      case "open":
        return setExpr(appendOpenParen(base));
      case "close":
        return setExpr(appendCloseParen(base));
      case "percent":
        return setExpr(appendPercent(base));
      case "sign":
        return setExpr(toggleSign(base));
      case "backspace":
        return setExpr(backspace(base));
      case "clear":
        return setExpr("");
      case "equals": {
        if (!expr) return;
        const result = evaluate(expr);
        if (!result.ok) return setError(result.error);
        const text = formatResult(result.value);
        setHistory((h) => [{ expression: expr, result: text }, ...h].slice(0, MAX_HISTORY));
        setExpr(text);
        setFresh(true);
      }
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Let buttons handle their own Enter/Space so keyboard users can operate the keypad.
    if ((e.key === "Enter" || e.key === " ") && (e.target as HTMLElement).tagName === "BUTTON") return;
    const action = actionForKey(e.key);
    if (!action) return;
    e.preventDefault();
    apply(action);
  };

  const key = (label: ReactNode, aria: string, action: KeyAction | { type: "sign" }, variant: "num" | "op" | "fn" | "equals" = "num", span = 1) => (
    <button
      key={aria}
      type="button"
      aria-label={aria}
      onClick={() => {
        apply(action);
        rootRef.current?.focus();
      }}
      className={cn(
        "h-12 rounded-xl text-lg font-medium transition-[background-color,transform] active:scale-95",
        variant === "num" && "bg-card hover:bg-muted",
        variant === "fn" && "bg-muted text-foreground/90 hover:bg-border",
        variant === "op" && "bg-accent text-accent-foreground hover:bg-accent/70",
        variant === "equals" && "bg-primary text-primary-foreground hover:bg-primary/90",
        span === 2 && "col-span-2",
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex h-full flex-col gap-3 bg-background p-3 outline-none"
      data-testid="calculator"
      aria-label="Calculator. Type numbers and operators on your keyboard."
    >
      <div className="relative flex min-h-[116px] flex-col justify-end rounded-xl border border-border bg-card px-4 py-3 text-right">
        <button
          type="button"
          aria-label={showHistory ? "Hide history" : "Show history"}
          aria-pressed={showHistory}
          onClick={() => setShowHistory((s) => !s)}
          className="absolute left-2 top-2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <History className="size-4" aria-hidden />
        </button>

        {showHistory ? (
          <ul aria-label="History" className="mb-1 max-h-20 space-y-0.5 self-stretch overflow-y-auto pl-9 text-sm text-muted-foreground">
            {history.length === 0 && <li className="italic">No calculations yet</li>}
            {history.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full truncate text-right hover:text-foreground"
                  onClick={() => {
                    setExpr(h.result);
                    setFresh(true);
                    setShowHistory(false);
                  }}
                  title="Use this result"
                >
                  {h.expression} = <span className="font-medium text-foreground">{h.result}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div data-testid="expression" className="min-h-6 break-all font-mono text-sm text-muted-foreground">
            {expr || " "}
          </div>
        )}

        <div
          data-testid="display"
          role="status"
          aria-live="polite"
          className={cn("mt-1 break-all font-mono text-3xl font-semibold tabular-nums", error && "text-lg text-destructive")}
        >
          {error ?? preview ?? "0"}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-4 gap-2">
        {key("(", "open parenthesis", { type: "open" }, "fn")}
        {key(")", "close parenthesis", { type: "close" }, "fn")}
        {key("^", "power", { type: "operator", value: "^" }, "fn")}
        {key(<Delete className="mx-auto size-5" aria-hidden />, "backspace", { type: "backspace" }, "fn")}
        {key("C", "clear", { type: "clear" }, "fn")}
        {key("%", "percent", { type: "percent" }, "fn")}
        {key("±", "change sign", { type: "sign" }, "fn")}
        {key("÷", "divide", { type: "operator", value: "÷" }, "op")}
        {["7", "8", "9"].map((d) => key(d, d, { type: "digit", value: d }))}
        {key("×", "multiply", { type: "operator", value: "×" }, "op")}
        {["4", "5", "6"].map((d) => key(d, d, { type: "digit", value: d }))}
        {key("−", "subtract", { type: "operator", value: "-" }, "op")}
        {["1", "2", "3"].map((d) => key(d, d, { type: "digit", value: d }))}
        {key("+", "add", { type: "operator", value: "+" }, "op")}
        {key("0", "0", { type: "digit", value: "0" }, "num", 2)}
        {key(".", "decimal point", { type: "decimal" })}
        {key("=", "equals", { type: "equals" }, "equals")}
      </div>
    </div>
  );
}
