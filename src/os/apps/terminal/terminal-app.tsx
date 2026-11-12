"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { HOME_ID } from "../../filesystem/types";
import { readSystemInfo } from "../../lib/system-info";
import { ROOM_THEMES } from "../../pixel/palette";
import { complete } from "../../shell/complete";
import { displayPath, executeLine } from "../../shell/commands";
import type { Line, ShellContext, Tone } from "../../shell/types";
import { useKernel, useWindowTitle } from "../../system/kernel-context";
import { OS_NAME, OS_VERSION } from "../../version";
import type { AppComponentProps } from "../types";
import { cn } from "@/lib/utils";

const MAX_LINES = 1000;
const MAX_HISTORY = 200;

const TONE_CLASS: Record<Tone, string> = {
  default: "",
  dir: "text-[oklch(0.78_0.12_245)] font-medium",
  error: "text-[oklch(0.75_0.15_25)]",
  muted: "text-[oklch(0.68_0.015_265)]",
  accent: "text-[oklch(0.8_0.13_285)]",
  success: "text-[oklch(0.8_0.15_155)]",
  warn: "text-[oklch(0.82_0.13_85)]",
};

interface Entry {
  id: number;
  line: Line;
}

export default function TerminalApp({ windowId }: AppComponentProps) {
  const kernel = useKernel();
  const { fs } = kernel;
  const [entries, setEntries] = useState<Entry[]>(() => [
    { id: 0, line: [{ text: `${OS_NAME} ${OS_VERSION}`, tone: "accent" }] },
    { id: 1, line: [{ text: "A simulated shell: it works on your virtual files and apps, and never touches your computer. Type 'help' to begin.", tone: "muted" }] },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState<string>(HOME_ID);
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number | null>(null); // position while browsing history
  const draft = useRef("");
  const nextId = useRef(2);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // If the current folder was deleted from elsewhere, fall back to Home.
  const effectiveCwd = fs.get(cwd) && !fs.isInTrash(cwd) ? cwd : HOME_ID;
  const promptText = `user@tinytools:${displayPath({ fs, cwd: effectiveCwd })}$`;
  useWindowTitle(windowId, `Terminal · ${displayPath({ fs, cwd: effectiveCwd })}`);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries]);

  const apps = useMemo(() => kernel.apps.map((a) => ({ id: a.id, name: a.name, description: a.description })), [kernel.apps]);

  const makeContext = (dir: string, past: readonly string[]): ShellContext => ({
    fs,
    cwd: dir,
    apps,
    running: () => kernel.wm.getState().windows.map((w) => ({ appId: w.appId, title: w.title })),
    openApp(query) {
      const q = query.trim().toLowerCase();
      const app = kernel.apps.find((a) => a.id === q || a.name.toLowerCase() === q);
      if (!app) return { ok: false, error: `no app called '${query}'. Type 'apps' for the list.` };
      kernel.openApp(app.id);
      return { ok: true, name: app.name };
    },
    openNode: (node) => kernel.openNode(node),
    prefs: kernel.prefs.get(),
    setPrefs: (patch) => kernel.prefs.set(patch),
    now: () => new Date(),
    bootedAt: kernel.bootedAt,
    history: past,
    system: readSystemInfo(),
    themeOptions: { themes: ROOM_THEMES.map((t) => t.id) },
  });

  const append = (lines: Line[]) =>
    setEntries((prev) => {
      const added = lines.map((line) => ({ id: nextId.current++, line }));
      return [...prev, ...added].slice(-MAX_LINES);
    });

  const run = (raw: string) => {
    const command = raw.trim();
    const echo: Line = [{ text: promptText + " ", tone: "success" }, { text: raw }];
    setCursor(null);
    setInput("");
    if (command === "") return append([echo]);

    const nextHistory = history[history.length - 1] === command ? history : [...history, command].slice(-MAX_HISTORY);
    setHistory(nextHistory);

    const result = executeLine(command, makeContext(effectiveCwd, nextHistory));
    if (result.clear) {
      setEntries([]);
    } else {
      append([echo, ...(result.lines ?? []), ...(result.errors ?? []).map((e): Line => [{ text: e, tone: "error" }])]);
    }
    if (result.cwd) setCwd(result.cwd);
    if (result.exit) kernel.closeWindow(windowId);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = cursor === null ? history.length - 1 : Math.max(0, cursor - 1);
      if (cursor === null) draft.current = input;
      setCursor(next);
      setInput(history[next]!);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cursor === null) return;
      if (cursor >= history.length - 1) {
        setCursor(null);
        setInput(draft.current);
      } else {
        setCursor(cursor + 1);
        setInput(history[cursor + 1]!);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const result = complete(input, makeContext(effectiveCwd, history));
      if (result.line !== input) setInput(result.line);
      // Several matches: list them under the prompt, like a real shell.
      if (result.suggestions.length > 1) {
        append([[{ text: promptText + " ", tone: "success" }, { text: input }], [{ text: result.suggestions.join("  "), tone: "muted" }]]);
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setEntries([]);
    } else if (e.ctrlKey && e.key.toLowerCase() === "c" && window.getSelection()?.toString() === "") {
      e.preventDefault();
      append([[{ text: promptText + " ", tone: "success" }, { text: input + "^C" }]]);
      setInput("");
      setCursor(null);
    } else if (e.ctrlKey && e.key.toLowerCase() === "u") {
      e.preventDefault();
      setInput("");
    }
  };

  return (
    <div
      ref={scrollRef}
      data-testid="terminal"
      className="h-full cursor-text overflow-y-auto bg-[oklch(0.17_0.01_265)] p-3 font-mono text-[13px] leading-relaxed text-[oklch(0.92_0.005_265)]"
      onClick={() => {
        // Clicking anywhere focuses the prompt, unless the user is selecting text to copy.
        if (window.getSelection()?.toString() === "") inputRef.current?.focus();
      }}
    >
      <div role="log" aria-live="polite" aria-label="Terminal output">
        {entries.map((entry) => (
          <div key={entry.id} className="whitespace-pre-wrap break-words">
            {entry.line.map((seg, i) => (
              <span key={i} className={TONE_CLASS[seg.tone ?? "default"]}>
                {seg.text}
              </span>
            ))}
            {entry.line.length === 0 && " "}
          </div>
        ))}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn("shrink-0 whitespace-pre", TONE_CLASS.success)} aria-hidden>
          {promptText}
        </span>
        <input
          ref={inputRef}
          autoFocus
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setCursor(null);
          }}
          onKeyDown={onKeyDown}
          aria-label={`Command line. Current folder ${displayPath({ fs, cwd: effectiveCwd })}`}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-inherit caret-[oklch(0.8_0.13_285)] outline-none"
        />
      </div>
    </div>
  );
}
