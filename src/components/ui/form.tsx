import * as React from "react";
import { cn } from "@/lib/utils";

const field = "w-full border border-foreground bg-background px-3 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-2";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(field, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-32 resize-y py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(field, "h-10 cursor-pointer pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium leading-none text-foreground", className)} {...props} />;
}

interface CheckboxProps extends Omit<React.ComponentProps<"input">, "type" | "onChange"> {
  label: React.ReactNode;
  hint?: string;
  onCheckedChange?: (checked: boolean) => void;
}

/** Native checkbox (keyboard + screen-reader friendly) with a label and optional hint. */
export function Checkbox({ label, hint, className, id, onCheckedChange, ...props }: CheckboxProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-black"
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      <div className="grid gap-0.5">
        <label htmlFor={inputId} className="cursor-pointer select-none text-sm leading-snug">
          {label}
        </label>
        {hint && (
          <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
}

/** A radio group shown as a row of plain buttons; arrow keys move between options. */
export function Segmented<T extends string>({ label, value, onChange, options, className }: SegmentedProps<T>) {
  const name = React.useId();
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex flex-wrap border border-foreground">
        {options.map((o) => (
          <label
            key={o.value}
            className="relative cursor-pointer px-3 py-1.5 text-sm hover:underline has-[:checked]:bg-foreground has-[:checked]:text-background has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
