import { create } from "zustand";
import type { Me } from "../api/types";

interface AuthState {
  token: string | null;
  user: Me | null;
  setAuth: (token: string, user: Me) => void;
  setUser: (user: Me) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem("cijie_token"),
  user: JSON.parse(localStorage.getItem("cijie_user") || "null") as Me | null,
  setAuth: (token, user) => {
    localStorage.setItem("cijie_token", token);
    localStorage.setItem("cijie_user", JSON.stringify(user));
    set({ token, user });
  },
  setUser: (user) => {
    localStorage.setItem("cijie_user", JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    localStorage.removeItem("cijie_token");
    localStorage.removeItem("cijie_user");
    set({ token: null, user: null });
  },
}));
