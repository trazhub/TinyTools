import { createStore, type Store } from "../lib/store";

export interface DialogueChoice {
  label: string;
  /** Runs when picked. The dialogue closes first unless `keepOpen` is set; `run` may start a new dialogue. */
  run: () => void;
  keepOpen?: boolean;
}

export interface DialoguePage {
  speaker: string;
  text: string;
  /** Show the player's face next to the text. */
  portrait?: boolean;
  choices?: DialogueChoice[];
  /** Runs each time this page appears (the tour uses it to point at objects). */
  onShow?: () => void;
}

export interface DialogueState {
  pages: readonly DialoguePage[];
  index: number;
}

export interface DialogueStore {
  state: Store<DialogueState | null>;
  /** Start a conversation. A plain string is a one-line narration. */
  say(pages: DialoguePage | DialoguePage[] | string): void;
  /** Move to the next page, or close after the last one (unless it has choices). */
  advance(): void;
  choose(index: number): void;
  close(): void;
}

export function createDialogueStore(): DialogueStore {
  const state = createStore<DialogueState | null>(null);

  const store: DialogueStore = {
    state,
    say(input) {
      const pages = typeof input === "string" ? [{ speaker: "", text: input }] : Array.isArray(input) ? input : [input];
      state.set(pages.length ? { pages, index: 0 } : null);
      pages[0]?.onShow?.();
    },
    advance() {
      const s = state.get();
      if (!s) return;
      const page = s.pages[s.index]!;
      if (page.choices?.length) return; // the player must pick
      if (s.index + 1 < s.pages.length) {
        state.set({ ...s, index: s.index + 1 });
        s.pages[s.index + 1]?.onShow?.();
      } else state.set(null);
    },
    choose(i) {
      const s = state.get();
      const choice = s?.pages[s.index]?.choices?.[i];
      if (!s || !choice) return;
      if (!choice.keepOpen) state.set(null);
      choice.run();
    },
    close() {
      state.set(null);
    },
  };
  return store;
}

/** Characters shown after `elapsedMs` at `charsPerSecond`. A non-positive speed shows everything at once. */
export function visibleLength(total: number, elapsedMs: number, charsPerSecond: number): number {
  if (charsPerSecond <= 0) return total;
  return Math.min(total, Math.max(0, Math.floor((elapsedMs / 1000) * charsPerSecond)));
}

/** Replace {name} in dialogue text. */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}
