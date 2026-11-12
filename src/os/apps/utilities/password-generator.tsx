"use client";

import { useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/form";
import { CopyButton } from "@/components/tool/copy-button";
import { ToolField } from "@/components/tool/tool-field";
import {
  DEFAULT_OPTIONS,
  MAX_LENGTH,
  MIN_LENGTH,
  generatePassword,
  strengthFromEntropy,
  type PasswordOptions,
  type PasswordResult,
  type Strength,
} from "@/lib/tools/password";
import { cn } from "@/lib/utils";

const STRENGTH_STYLE: Record<Strength, { label: string; bar: string; width: string }> = {
  weak: { label: "Weak", bar: "bg-destructive", width: "w-1/4" },
  fair: { label: "Fair", bar: "bg-warning", width: "w-2/4" },
  good: { label: "Good", bar: "bg-primary", width: "w-3/4" },
  strong: { label: "Strong", bar: "bg-success", width: "w-full" },
};

export default function PasswordGenerator() {
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_OPTIONS);
  // Safe to generate during the first render: tool components are client-only (no SSR).
  const [result, setResult] = useState<PasswordResult>(() => generatePassword(DEFAULT_OPTIONS));
  const [visible, setVisible] = useState(true);

  function update(patch: Partial<PasswordOptions>) {
    const next = { ...options, ...patch };
    setOptions(next);
    setResult(generatePassword(next));
  }

  const strength = result.ok ? STRENGTH_STYLE[strengthFromEntropy(result.entropyBits)] : null;
  const password = result.ok ? result.password : "";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <output
            aria-label="Generated password"
            aria-live="off"
            data-testid="password-output"
            className={cn(
              "block min-h-14 flex-1 break-all rounded-xl border border-input bg-muted/50 px-4 py-3 font-mono text-lg leading-snug",
              !result.ok && "text-muted-foreground",
            )}
          >
            {result.ok ? (visible ? password : "•".repeat(password.length)) : "No password yet"}
          </output>
        </div>

        {strength && result.ok && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">
                Strength: <span data-testid="strength-label">{strength.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">≈ {Math.round(result.entropyBits)} bits of entropy</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className={cn("h-full rounded-full transition-all duration-300", strength.bar, strength.width)} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => update({})}>
            <RefreshCw aria-hidden /> Generate new
          </Button>
          <CopyButton text={password} label="Copy password" />
          <Button variant="ghost" onClick={() => setVisible((v) => !v)} aria-pressed={!visible}>
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {visible ? "Hide" : "Show"}
          </Button>
        </div>
      </div>

      {!result.ok && <Alert tone="error">{result.error}</Alert>}

      <fieldset className="space-y-5 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold">Options</legend>

        <ToolField label="Length" htmlFor="pw-length">
          <div className="flex items-center gap-4">
            <input
              id="pw-length"
              type="range"
              className="range"
              min={MIN_LENGTH}
              max={64}
              value={Math.min(options.length, 64)}
              onChange={(e) => update({ length: Number(e.target.value) })}
              aria-valuetext={`${options.length} characters`}
            />
            <Input
              aria-label="Length as a number"
              type="number"
              inputMode="numeric"
              min={MIN_LENGTH}
              max={MAX_LENGTH}
              value={Number.isNaN(options.length) ? "" : options.length}
              onChange={(e) => update({ length: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
              className="w-24 shrink-0 tabular-nums"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {MIN_LENGTH} to {MAX_LENGTH} characters. The slider goes to 64; type a number for longer.
          </p>
        </ToolField>

        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox label="Lowercase (a–z)" checked={options.lowercase} onCheckedChange={(v) => update({ lowercase: v })} />
          <Checkbox label="Uppercase (A–Z)" checked={options.uppercase} onCheckedChange={(v) => update({ uppercase: v })} />
          <Checkbox label="Numbers (0–9)" checked={options.digits} onCheckedChange={(v) => update({ digits: v })} />
          <Checkbox label="Symbols (!@#$…)" checked={options.symbols} onCheckedChange={(v) => update({ symbols: v })} />
        </div>
        <Checkbox
          label="Exclude look-alike characters"
          hint="Leaves out I, l, 1, |, O, 0 and o, which are easy to confuse."
          checked={options.excludeAmbiguous}
          onCheckedChange={(v) => update({ excludeAmbiguous: v })}
        />
      </fieldset>
    </div>
  );
}
