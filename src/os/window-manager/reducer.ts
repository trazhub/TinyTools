import { clamp, clampPosition, fitToArea, type Rect } from "./geometry";
import type { OpenWindowInput, WindowState, WMAction, WMState } from "./types";

export const DEFAULT_WORK_AREA: Rect = { x: 0, y: 0, width: 1280, height: 720 };

export function createInitialState(workArea: Rect = DEFAULT_WORK_AREA): WMState {
  return { windows: [], focusedId: null, nextZ: 1, nextId: 1, workArea, lastBounds: {}, cascade: 0 };
}

// ---- selectors -------------------------------------------------------------

export function getWindow(state: WMState, id: string): WindowState | undefined {
  return state.windows.find((w) => w.id === id);
}

/** Order windows from most recently used (front-most) to least. */
export function byRecency(windows: readonly WindowState[]): WindowState[] {
  return [...windows].sort((a, b) => b.z - a.z);
}

export function mruWindows(state: WMState): WindowState[] {
  return byRecency(state.windows);
}

function topVisible(windows: readonly WindowState[], excludeId?: string): WindowState | undefined {
  let best: WindowState | undefined;
  for (const w of windows) {
    if (w.minimized || w.id === excludeId) continue;
    if (!best || w.z > best.z) best = w;
  }
  return best;
}

// ---- helpers ---------------------------------------------------------------

function update(state: WMState, id: string, fn: (w: WindowState) => WindowState): WMState {
  let changed = false;
  const windows = state.windows.map((w) => {
    if (w.id !== id) return w;
    const next = fn(w);
    if (next !== w) changed = true;
    return next;
  });
  return changed ? { ...state, windows } : state;
}

function bringToFront(state: WMState, id: string): WMState {
  const target = getWindow(state, id);
  if (!target) return state;
  if (state.focusedId === id && !target.minimized && target.z === state.nextZ - 1) return state;
  const windows = state.windows.map((w) => (w.id === id ? { ...w, minimized: false, z: state.nextZ } : w));
  return { ...state, windows, focusedId: id, nextZ: state.nextZ + 1 };
}

function focusTopRemaining(state: WMState, excludeId: string): WMState {
  const next = topVisible(state.windows, excludeId);
  return { ...state, focusedId: next ? next.id : null };
}

const CASCADE_STEP = 28;
const CASCADE_SLOTS = 8;

function initialRect(state: WMState, input: OpenWindowInput): Rect {
  const area = state.workArea;
  const remembered = state.lastBounds[input.appId];
  if (remembered) return fitToArea(remembered, area, input.minSize);

  const width = Math.min(input.size.width, area.width);
  const height = Math.min(input.size.height, area.height);
  const offset = (state.cascade % CASCADE_SLOTS) * CASCADE_STEP;
  const x = area.x + Math.max(0, Math.round((area.width - width) / 2)) - 80 + offset;
  const y = area.y + Math.max(0, Math.round((area.height - height) / 2)) - 60 + offset;
  return fitToArea({ x: Math.max(area.x, x), y: Math.max(area.y, y), width, height }, area, input.minSize);
}

// ---- reducer ---------------------------------------------------------------

export function wmReducer(state: WMState, action: WMAction): WMState {
  switch (action.type) {
    case "open": {
      if (action.singleton) {
        const existing = state.windows.find((w) => w.appId === action.appId);
        if (existing) {
          const withProps = action.props
            ? update(state, existing.id, (w) => ({ ...w, props: { ...w.props, ...action.props } }))
            : state;
          return bringToFront(withProps, existing.id);
        }
      }
      const id = `win-${state.nextId}`;
      const win: WindowState = {
        id,
        appId: action.appId,
        title: action.title,
        rect: initialRect(state, action),
        minimized: false,
        maximized: false,
        z: state.nextZ,
        minSize: action.minSize,
        resizable: action.resizable,
        props: action.props ?? {},
      };
      return {
        ...state,
        windows: [...state.windows, win],
        focusedId: id,
        nextId: state.nextId + 1,
        nextZ: state.nextZ + 1,
        cascade: state.cascade + 1,
      };
    }

    case "close": {
      const win = getWindow(state, action.id);
      if (!win) return state;
      const next: WMState = {
        ...state,
        windows: state.windows.filter((w) => w.id !== action.id),
        lastBounds: { ...state.lastBounds, [win.appId]: win.rect },
      };
      return state.focusedId === action.id ? focusTopRemaining(next, action.id) : next;
    }

    case "closeAll":
      return { ...state, windows: [], focusedId: null, cascade: 0 };

    case "focus":
      return bringToFront(state, action.id);

    case "minimize": {
      const win = getWindow(state, action.id);
      if (!win || win.minimized) return state;
      const next = update(state, action.id, (w) => ({ ...w, minimized: true }));
      return state.focusedId === action.id ? focusTopRemaining(next, action.id) : next;
    }

    case "restore":
      return bringToFront(state, action.id);

    case "toggleFromTaskbar": {
      const win = getWindow(state, action.id);
      if (!win) return state;
      if (win.minimized) return bringToFront(state, action.id);
      if (state.focusedId === action.id) return wmReducer(state, { type: "minimize", id: action.id });
      return bringToFront(state, action.id);
    }

    case "maximize": {
      const win = getWindow(state, action.id);
      if (!win || !win.resizable || win.maximized) return state;
      return bringToFront(update(state, action.id, (w) => ({ ...w, maximized: true })), action.id);
    }

    case "unmaximize":
      return update(state, action.id, (w) => (w.maximized ? { ...w, maximized: false } : w));

    case "toggleMaximize": {
      const win = getWindow(state, action.id);
      if (!win) return state;
      return wmReducer(state, { type: win.maximized ? "unmaximize" : "maximize", id: action.id });
    }

    case "move": {
      // Moving a maximized window restores it first (it "tears off" at the pointer).
      return update(state, action.id, (w) => {
        const rect = clampPosition({ ...w.rect, x: action.x, y: action.y }, state.workArea);
        if (!w.maximized && rect.x === w.rect.x && rect.y === w.rect.y) return w;
        return { ...w, rect, maximized: false };
      });
    }

    case "resize": {
      return update(state, action.id, (w) => {
        if (!w.resizable || w.maximized) return w;
        const width = clamp(action.rect.width, w.minSize.width, Math.max(w.minSize.width, state.workArea.width));
        const height = clamp(action.rect.height, w.minSize.height, Math.max(w.minSize.height, state.workArea.height));
        const rect = clampPosition({ x: action.rect.x, y: action.rect.y, width, height }, state.workArea);
        const same = rect.x === w.rect.x && rect.y === w.rect.y && rect.width === w.rect.width && rect.height === w.rect.height;
        return same ? w : { ...w, rect };
      });
    }

    case "setTitle":
      return update(state, action.id, (w) => (w.title === action.title ? w : { ...w, title: action.title }));

    case "setWorkArea": {
      const area = action.rect;
      const same =
        area.x === state.workArea.x &&
        area.y === state.workArea.y &&
        area.width === state.workArea.width &&
        area.height === state.workArea.height;
      if (same) return state;
      return {
        ...state,
        workArea: area,
        windows: state.windows.map((w) => {
          const rect = fitToArea(w.rect, area, w.minSize);
          return rect.x === w.rect.x && rect.y === w.rect.y && rect.width === w.rect.width && rect.height === w.rect.height
            ? w
            : { ...w, rect };
        }),
      };
    }

    case "hydrate":
      return { ...state, ...action.state, cascade: action.state.windows.length };
  }
}
