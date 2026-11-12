"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useStore } from "../lib/store";
import { useKernel } from "./kernel-context";
import type { DialogRequest } from "./dialogs";

/** Shows in-OS modal dialogs, one at a time. */
export function DialogHost() {
  const kernel = useKernel();
  const dialogs = useStore(kernel.dialogs.state, (s) => s);
  const current = dialogs[0];
  return current ? <DialogPanel key={current.id} dialog={current} /> : null;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

function DialogPanel({ dialog }: { dialog: DialogRequest }) {
  const kernel = useKernel();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const [value, setValue] = useState(dialog.kind === "prompt" ? (dialog.options.initial ?? "") : "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const input = inputRef.current;
    if (input) {
      input.focus();
      const initial = input.value;
      const dot = dialog.kind === "prompt" && dialog.options.selectBaseName ? initial.lastIndexOf(".") : -1;
      input.setSelectionRange(0, dot > 0 ? dot : initial.length);
    } else {
      panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    return () => {
      const el = previouslyFocused.current;
      if (el instanceof HTMLElement && el.isConnected) el.focus({ preventScroll: true });
    };
  }, [dialog]);

  const cancel = () => kernel.dialogs.settle(dialog.id);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dialog.kind === "confirm") return dialog.resolve(true);
    const problem = dialog.options.validate?.(value) ?? null;
    if (problem) return setError(problem);
    if (value.trim() === "") return setError("Please enter a name.");
    dialog.resolve(value);
  };

  // Keep Tab inside the dialog and let Escape cancel it.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === "Tab") {
      const nodes = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const { options } = dialog;
  const confirmLabel = options.confirmLabel ?? "OK";
  const danger = dialog.kind === "confirm" && dialog.options.danger;

  return (
    <div className="absolute inset-0 z-[9900] grid place-items-center bg-black/40 p-4 animate-fade-in" data-testid="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && cancel()}>
      <form
        ref={panelRef}
        role={dialog.kind === "confirm" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={dialog.kind === "confirm" && dialog.options.message ? descId : undefined}
        onSubmit={submit}
        onKeyDown={onKeyDown}
        className="px-panel w-full max-w-sm animate-pop-in space-y-4 rounded-2xl p-5"
      >
        <h2 id={titleId} className="text-base font-semibold">
          {options.title}
        </h2>

        {dialog.kind === "confirm" && dialog.options.message && (
          <p id={descId} className="text-sm leading-relaxed text-muted-foreground">
            {dialog.options.message}
          </p>
        )}

        {dialog.kind === "prompt" && (
          <div className="space-y-1.5">
            {dialog.options.label && (
              <label htmlFor={`${titleId}-input`} className="text-sm font-medium">
                {dialog.options.label}
              </label>
            )}
            <Input
              id={`${titleId}-input`}
              ref={inputRef}
              value={value}
              placeholder={dialog.options.placeholder}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error !== null}
              aria-describedby={error ? `${titleId}-error` : undefined}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p id={`${titleId}-error`} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {/* Destructive confirmations start on Cancel so a stray Enter can't delete anything. */}
          <Button type="button" variant="outline" onClick={cancel} data-autofocus={danger ? "" : undefined}>
            {dialog.kind === "confirm" ? (dialog.options.cancelLabel ?? "Cancel") : "Cancel"}
          </Button>
          <Button type="submit" variant={danger ? "destructive" : "default"} data-autofocus={danger ? undefined : ""}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
