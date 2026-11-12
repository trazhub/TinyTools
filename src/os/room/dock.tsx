"use client";

import { BookOpen, Gamepad2, Keyboard, MessageCircle, Monitor, Music, StickyNote, type LucideIcon } from "lucide-react";
import { AppIcon } from "../apps/app-icon";
import { DOCK_HEIGHT } from "../layout";
import { useKernel, useUI, useWM } from "../system/kernel-context";
import { cn } from "@/lib/utils";
import { runRoomAction } from "./actions";
import { placedItems } from "./layout";

const ITEMS = placedItems();
const find = (id: string) => ITEMS.find((i) => i.id === id)!;

/** Quick access for small screens, where tapping tiny furniture is fiddly. Every one does what its object does. */
const QUICK: { label: string; icon: LucideIcon; id: string }[] = [
  { label: "Computer", icon: Monitor, id: "computer" },
  { label: "Files", icon: BookOpen, id: "bookshelf" },
  { label: "Notes", icon: StickyNote, id: "notebook" },
  { label: "Window", icon: Keyboard, id: "window" },
  { label: "Music", icon: Music, id: "record-player" },
  { label: "Game", icon: Gamepad2, id: "handheld" },
  { label: "Chat", icon: MessageCircle, id: "character" },
];

/** The strip along the bottom: open windows, or quick-access buttons on phones when none are open. */
export function Dock() {
  const kernel = useKernel();
  const windows = useWM((s) => s.windows);
  const focusedId = useWM((s) => s.focusedId);
  const mobile = useUI((s) => s.mobile);

  return (
    <div className="absolute inset-x-0 bottom-0 z-[9000] flex items-center gap-3 overflow-x-auto px-4" style={{ height: DOCK_HEIGHT }} data-testid="dock">
      {windows.length > 0 ? (
        <nav aria-label="Open windows" className="flex items-center gap-3">
          {windows.map((w) => {
            const app = kernel.getApp(w.appId);
            const active = focusedId === w.id && !w.minimized;
            return (
              <button
                key={w.id}
                type="button"
                data-window-tab={w.id}
                aria-pressed={active}
                aria-label={`${w.title}${w.minimized ? " (minimized)" : ""}`}
                onClick={() => {
                  kernel.sfx("click");
                  kernel.wm.dispatch({ type: "toggleFromTaskbar", id: w.id });
                }}
                className={cn("px-btn font-pixel flex h-10 max-w-[200px] shrink-0 items-center gap-2 px-3 text-[15px] font-semibold", active ? "" : "opacity-80")}
                style={active ? undefined : { filter: "saturate(0.7)" }}
              >
                {app && <AppIcon app={app} size={22} />}
                <span className="truncate">{w.title}</span>
              </button>
            );
          })}
        </nav>
      ) : mobile ? (
        <nav aria-label="Quick access" className="flex items-center gap-3">
          {QUICK.map(({ label, icon: Icon, id }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              onClick={() => {
                kernel.sfx("click");
                runRoomAction(find(id), kernel);
              }}
              className="px-btn font-pixel flex h-10 shrink-0 items-center gap-2 px-3 text-[14px] font-semibold"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      ) : (
        <p className="font-pixel mx-auto text-[14px] text-muted-foreground" aria-hidden>
          Click things in the room, or press Ctrl+K for every app
        </p>
      )}
    </div>
  );
}
