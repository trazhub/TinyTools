"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useReducedMotion } from "../lib/hooks";
import { useStore } from "../lib/store";
import { PixelIcon } from "../pixel/pixel-context";
import { DOCK_HEIGHT } from "../layout";
import { useKernel, usePrefs } from "../system/kernel-context";
import { visibleLength, type DialoguePage } from "../system/dialogue";

const CHARS_PER_SECOND = 55;

/** The NPC-style text box. Text types out; click, Enter or Space finishes it, then moves on. */
export function DialogueBox() {
  const kernel = useKernel();
  const state = useStore(kernel.dialogue.state, (s) => s);
  const page = state?.pages[state.index];
  if (!state || !page) return null;
  return <DialoguePanel key={`${state.pages.length}-${state.index}-${page.text}`} page={page} isLast={state.index === state.pages.length - 1} />;
}

function DialoguePanel({ page, isLast }: { page: DialoguePage; isLast: boolean }) {
  const kernel = useKernel();
  const prefs = usePrefs();
  const reduced = useReducedMotion(prefs.motion);
  const speed = reduced ? 0 : CHARS_PER_SECOND;
  const [started] = useState(() => Date.now());
  const [shown, setShown] = useState(() => visibleLength(page.text.length, 0, speed));
  const done = shown >= page.text.length;
  const root = useRef<HTMLDivElement>(null);
  const hasChoices = Boolean(page.choices?.length);

  // Reveal the text over time. The interval only updates state in its callback.
  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setShown(visibleLength(page.text.length, Date.now() - started, speed)), 33);
    return () => clearInterval(timer);
  }, [done, page.text.length, speed, started]);

  // Keyboard users land on the box (or its first choice) so Enter/Space just work.
  useEffect(() => {
    if (!done) {
      root.current?.focus({ preventScroll: true });
      return;
    }
    if (hasChoices) root.current?.querySelector<HTMLElement>("[data-choice]")?.focus({ preventScroll: true });
    else root.current?.focus({ preventScroll: true });
  }, [done, hasChoices]);

  const next = () => {
    if (!done) setShown(page.text.length);
    else if (!hasChoices) kernel.dialogue.advance();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      kernel.dialogue.close();
    } else if ((e.key === "Enter" || e.key === " ") && !(e.target as HTMLElement).closest("[data-choice]")) {
      e.preventDefault();
      next();
    } else if (hasChoices && (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      const choices = [...(root.current?.querySelectorAll<HTMLElement>("[data-choice]") ?? [])];
      const i = choices.indexOf(document.activeElement as HTMLElement);
      if (choices.length) {
        e.preventDefault();
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        choices[(i + step + choices.length) % choices.length]!.focus();
      }
    }
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 z-[9300] flex justify-center px-4" style={{ bottom: DOCK_HEIGHT + 14 }}>
      <div
        ref={root}
        role="dialog"
        aria-label={page.speaker ? `${page.speaker} says` : "Message"}
        tabIndex={-1}
        data-testid="dialogue"
        onKeyDown={onKeyDown}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button")) next();
        }}
        className="px-panel pointer-events-auto flex w-full max-w-[760px] animate-pop-in gap-4 bg-[var(--px-title-inactive)] p-4 outline-none"
        style={{ background: "var(--background)" }}
      >
        {page.portrait && (
          <div className="px-frame hidden h-[84px] w-[84px] shrink-0 place-items-center self-start bg-[var(--px-title)] sm:grid" aria-hidden>
            <PixelIcon id="portrait" scale={3} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {page.speaker && <p className="font-pixel mb-1 text-[15px] font-bold text-primary">{page.speaker}</p>}
          {/* Screen readers get the whole line at once; sighted users see it typed out. */}
          <p className="sr-only" role="status">
            {page.text}
          </p>
          <p aria-hidden className="font-pixel min-h-[3.2em] whitespace-pre-wrap text-[19px] leading-[1.35] text-foreground">
            {page.text.slice(0, shown)}
            <span className="invisible">{page.text.slice(shown)}</span>
          </p>

          {done && hasChoices && (
            <div className="mt-3 flex flex-wrap gap-3" role="group" aria-label="Choices">
              {page.choices!.map((choice, i) => (
                <button key={`${choice.label}-${i}`} type="button" data-choice className="px-btn font-pixel min-h-9 px-4 text-[16px] font-semibold" onClick={() => kernel.dialogue.choose(i)}>
                  {choice.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {done && !hasChoices && (
          <button
            type="button"
            aria-label={isLast ? "Close" : "Next"}
            onClick={next}
            className="self-end"
            style={{ animation: "px-bounce 0.8s steps(1, end) infinite" }}
          >
            <PixelIcon id="dialogueArrow" scale={3} />
          </button>
        )}
      </div>
    </div>
  );
}
