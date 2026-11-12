"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { AppIcon } from "../apps/app-icon";
import { CATEGORY_LABELS, type AppDefinition } from "../apps/types";
import { DOCK_HEIGHT, HUD_HEIGHT } from "../layout";
import { useKernel, usePrefs, useUI } from "../system/kernel-context";
import { cn } from "@/lib/utils";
import { searchApps } from "./search";

export function ComputerLauncher() {
  const open = useUI((s) => s.launcherOpen);
  return open ? <Panel /> : null;
}

/** What you see when you sit down at the computer: every app, searchable, on a little CRT. */
function Panel() {
  const kernel = useKernel();
  const prefs = usePrefs();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const searching = query.trim() !== "";
  const entries = useMemo(() => {
    if (searching) return searchApps(kernel.apps, query);
    const pinned = prefs.pinned.map((id) => kernel.getApp(id)).filter((a): a is AppDefinition => Boolean(a));
    const rest = kernel.apps.filter((a) => !pinned.includes(a));
    return [...pinned, ...rest];
  }, [searching, query, kernel, prefs.pinned]);
  const activeIndex = Math.min(active, Math.max(0, entries.length - 1));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  const close = () => {
    kernel.setLauncherOpen(false);
    kernel.sfx("close");
  };
  const launch = (app: AppDefinition | undefined) => {
    if (app) kernel.openApp(app.id);
  };

  const columns = () => {
    const tiles = [...(gridRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])];
    if (tiles.length < 2) return 1;
    const top = tiles[0]!.offsetTop;
    const i = tiles.findIndex((t) => t.offsetTop !== top);
    return i === -1 ? tiles.length : i;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const go = (n: number) => {
      e.preventDefault();
      setActive(Math.min(Math.max(n, 0), entries.length - 1));
    };
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else close();
    } else if (e.key === "ArrowRight") go(activeIndex + 1);
    else if (e.key === "ArrowLeft") go(activeIndex - 1);
    else if (e.key === "ArrowDown") go(activeIndex + columns());
    else if (e.key === "ArrowUp") go(activeIndex - columns());
    else if (e.key === "Enter") {
      e.preventDefault();
      launch(entries[activeIndex]);
    }
  };

  return (
    <>
      <div className="absolute inset-0 z-[9400] bg-black/45 animate-fade-in" aria-hidden onPointerDown={close} data-testid="launcher-backdrop" />
      <div className="pointer-events-none absolute inset-x-0 z-[9500] flex items-center justify-center p-4" style={{ top: HUD_HEIGHT, bottom: DOCK_HEIGHT }}>
        <div
          role="dialog"
          aria-label="Computer: all apps"
          data-testid="start-menu"
          onKeyDown={onKeyDown}
          className="px-panel px-crt pointer-events-auto relative flex max-h-full w-full max-w-[720px] animate-pop-in flex-col overflow-hidden bg-[var(--background)]"
        >
          <div className="flex items-center justify-between gap-3 bg-titlebar px-4 py-2">
            <h2 className="font-pixel text-[18px] font-bold tracking-wide text-foreground">C:\TINYTOOLS&gt;_</h2>
            <button type="button" aria-label="Close the computer" onClick={close} className="px-btn grid size-7 place-items-center">
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="p-4 pb-2">
            <label className="relative block">
              <span className="sr-only">Search apps</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={entries.length ? `${listId}-${activeIndex}` : undefined}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search apps…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                className="px-field h-10 w-full pl-9 pr-3 text-sm placeholder:text-muted-foreground"
              />
            </label>
          </div>

          <div ref={gridRef} id={listId} role="listbox" aria-label={searching ? "Search results" : "Apps"} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {entries.length === 0 ? (
              <p role="status" className="py-10 text-center text-sm text-muted-foreground">
                Nothing matches “{query.trim()}”.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 pt-2 sm:grid-cols-4">
                {entries.map((app, i) => (
                  <button
                    key={app.id}
                    id={`${listId}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    tabIndex={-1}
                    data-app-id={app.id}
                    title={app.description}
                    onClick={() => launch(app)}
                    onPointerMove={() => setActive(i)}
                    className={cn("flex flex-col items-center gap-2 p-3 text-center", i === activeIndex ? "bg-accent outline outline-2 -outline-offset-2 outline-primary" : "hover:bg-muted")}
                  >
                    <AppIcon app={app} size={44} />
                    <span className="font-pixel w-full text-[15px] font-semibold leading-tight">{app.name}</span>
                    <span className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[app.category]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t-2 border-border px-4 py-2 text-xs text-muted-foreground">
            ←↑↓→ choose · Enter open · Esc close · {kernel.apps.length} apps installed
          </div>
        </div>
      </div>
    </>
  );
}
