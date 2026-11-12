import { createStore, type Store } from "../lib/store";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive. */
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  label?: string;
  initial?: string;
  confirmLabel?: string;
  placeholder?: string;
  /** Return an error message to keep the dialog open, or null to accept. */
  validate?: (value: string) => string | null;
  /** Select only the part before the extension on open (for renaming files). */
  selectBaseName?: boolean;
}

export type DialogRequest =
  | { id: number; kind: "confirm"; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { id: number; kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void };

export interface DialogStore {
  state: Store<readonly DialogRequest[]>;
  confirm(options: ConfirmOptions): Promise<boolean>;
  prompt(options: PromptOptions): Promise<string | null>;
  /** Resolve the front dialog with its "cancelled" answer and show the next one. */
  settle(id: number): void;
}

/** In-OS modal dialogs (never window.confirm/prompt), shown one at a time. */
export function createDialogStore(): DialogStore {
  const state = createStore<readonly DialogRequest[]>([]);
  let nextId = 1;
  const remove = (id: number) => state.set((prev) => prev.filter((d) => d.id !== id));

  return {
    state,
    confirm(options) {
      return new Promise<boolean>((resolve) => {
        const id = nextId++;
        state.set((prev) => [...prev, { id, kind: "confirm", options, resolve: (ok) => { remove(id); resolve(ok); } }]);
      });
    },
    prompt(options) {
      return new Promise<string | null>((resolve) => {
        const id = nextId++;
        state.set((prev) => [...prev, { id, kind: "prompt", options, resolve: (value) => { remove(id); resolve(value); } }]);
      });
    },
    settle(id) {
      const dialog = state.get().find((d) => d.id === id);
      if (!dialog) return;
      if (dialog.kind === "confirm") dialog.resolve(false);
      else dialog.resolve(null);
    },
  };
}
