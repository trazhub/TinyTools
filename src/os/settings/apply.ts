import { ROOM_THEMES } from "../pixel/palette";
import { PREFS_KEY, type Prefs } from "./prefs";

/** Reflect preferences onto <html>: the room theme and motion mode drive the CSS. */
export function applyPrefsToDocument(prefs: Prefs, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = prefs.theme;
  root.dataset.motion = prefs.motion;
}

/**
 * Source of a tiny script run in <head> before the first paint, so a saved theme
 * never flashes the default. Built only from constants (no user input).
 */
export function themeBootScript(): string {
  const ids = ROOM_THEMES.map((t) => t.id);
  return `(function(){try{var r=document.documentElement;var s=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"null");var p=(s&&s.prefs)||{};var ok=${JSON.stringify(ids)};r.dataset.theme=ok.indexOf(p.theme)>-1?p.theme:"midnight";r.dataset.motion=p.motion==="reduce"||p.motion==="full"?p.motion:"system";}catch(e){}})();`;
}
