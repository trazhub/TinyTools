import { createInitialState, wmReducer } from "./reducer";
import type { Rect } from "./geometry";
import type { WMAction, WMState } from "./types";

/** A tiny external store so each window can subscribe to just its own slice of state. */
export interface WindowStore {
  getState(): WMState;
  dispatch(action: WMAction): void;
  subscribe(listener: () => void): () => void;
}

export function createWindowStore(workArea?: Rect): WindowStore {
  let state = createInitialState(workArea);
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = wmReducer(state, action);
      if (next === state) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
