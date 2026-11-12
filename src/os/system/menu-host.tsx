"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { useStore } from "../lib/store";
import { useKernel } from "./kernel-context";
import { isSeparator, type OpenMenu } from "./menus";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 232;
const ITEM_HEIGHT = 34;

export function MenuHost() {
  const kernel = useKernel();
  const menu = useStore(kernel.menus.state, (s) => s);
  return menu ? <MenuPanel key={`${menu.x}:${menu.y}:${menu.items.length}`} menu={menu} /> : null;
}

function MenuPanel({ menu }: { menu: OpenMenu }) {
  const kernel = useKernel();
  const ref = useRef<HTMLDivElement>(null);

  const dismiss = () => {
    kernel.menus.close();
    if (menu.returnFocus?.isConnected) menu.returnFocus.focus({ preventScroll: true });
  };

  // Close on Escape, window blur or resize; focus the first item for keyboard users.
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])');
    first?.focus({ preventScroll: true });
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        kernel.menus.close();
        if (menu.returnFocus?.isConnected) menu.returnFocus.focus({ preventScroll: true });
      }
    };
    const closeIt = () => kernel.menus.close();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", closeIt);
    window.addEventListener("resize", closeIt);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", closeIt);
      window.removeEventListener("resize", closeIt);
    };
  }, [kernel, menu]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i < 0 ? items.length - 1 : i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") {
      e.preventDefault();
      dismiss();
    }
  };

  const height = menu.items.reduce((h, item) => h + (isSeparator(item) ? 9 : ITEM_HEIGHT), 12);
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 720 : window.innerHeight;
  const left = Math.max(8, Math.min(menu.x, vw - MENU_WIDTH - 8));
  const top = Math.max(8, Math.min(menu.y, vh - height - 8));

  return (
    <>
      <div
        className="absolute inset-0 z-[9600]"
        aria-hidden
        onPointerDown={dismiss}
        onContextMenu={(e) => {
          e.preventDefault();
          dismiss();
        }}
      />
      <div
        ref={ref}
        role="menu"
        aria-orientation="vertical"
        data-testid="context-menu"
        onKeyDown={onKeyDown}
        className="px-panel os-chrome absolute z-[9700] animate-pop-in rounded-xl p-1.5"
        style={{ left, top, width: MENU_WIDTH }}
      >
        {menu.items.map((item) =>
          isSeparator(item) ? (
            <div key={item.id} role="separator" className="mx-1 my-1 h-px bg-border" />
          ) : (
            <button
              key={item.id}
              type="button"
              role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
              aria-checked={item.checked}
              aria-disabled={item.disabled || undefined}
              tabIndex={-1}
              onClick={() => {
                if (item.disabled) return;
                kernel.menus.close();
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] outline-none transition-colors",
                "focus-visible:bg-primary focus-visible:text-primary-foreground hover:bg-foreground/10",
                item.danger && "text-destructive focus-visible:text-primary-foreground",
                item.disabled && "pointer-events-none opacity-45",
              )}
              style={{ height: ITEM_HEIGHT - 2 }}
            >
              <span className="grid size-4 shrink-0 place-items-center">
                {item.checked ? <Check className="size-4" aria-hidden /> : item.icon ? <item.icon className="size-4" aria-hidden /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.shortcut && <kbd className="ml-2 font-sans text-[11px] text-muted-foreground">{item.shortcut}</kbd>}
            </button>
          ),
        )}
      </div>
    </>
  );
}
