import { create } from "zustand";

interface Toast {
  id: number;
  msg: string;
}

interface UIState {
  toasts: Toast[];
  toast: (msg: string) => void;
  floats: { id: number; delta: number; x: number; y: number }[];
  float: (delta: number, x: number, y: number) => void;
}

let nextId = 1;

export const useUI = create<UIState>((set) => ({
  toasts: [],
  toast: (msg) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, msg }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600);
  },
  floats: [],
  float: (delta, x, y) => {
    const id = nextId++;
    set((s) => ({ floats: [...s.floats, { id, delta, x, y }] }));
    setTimeout(() => set((s) => ({ floats: s.floats.filter((f) => f.id !== id) })), 1000);
  },
}));

export function toast(msg: string) {
  useUI.getState().toast(msg);
}

export function floatPts(delta: number, anchor?: HTMLElement | null) {
  if (!delta) return;
  let x = window.innerWidth / 2,
    y = 60;
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top - 6;
  }
  useUI.getState().float(delta, x, y);
}
