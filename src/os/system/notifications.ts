import { createStore, type Store } from "../lib/store";

export type ToastTone = "info" | "success" | "warning" | "error";

export interface Toast {
  id: number;
  title?: string;
  message: string;
  tone: ToastTone;
  /** Milliseconds before the toast closes itself. 0 keeps it until dismissed. */
  duration: number;
}

export type ToastInput = Omit<Toast, "id" | "tone" | "duration"> & { tone?: ToastTone; duration?: number };

export const MAX_TOASTS = 4;

export interface ToastStore {
  state: Store<readonly Toast[]>;
  notify(input: ToastInput): number;
  dismiss(id: number): void;
  clear(): void;
}

export function createToastStore(): ToastStore {
  const state = createStore<readonly Toast[]>([]);
  let nextId = 1;
  return {
    state,
    notify(input) {
      const toast: Toast = {
        id: nextId++,
        tone: input.tone ?? "info",
        // Errors stay a little longer; they matter more.
        duration: input.duration ?? (input.tone === "error" ? 8000 : 4500),
        ...(input.title ? { title: input.title } : {}),
        message: input.message,
      };
      state.set((prev) => [...prev, toast].slice(-MAX_TOASTS));
      return toast.id;
    },
    dismiss(id) {
      state.set((prev) => (prev.some((t) => t.id === id) ? prev.filter((t) => t.id !== id) : prev));
    },
    clear() {
      state.set([]);
    },
  };
}
