import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";
import { API_BASE } from "../lib/config";

const raw = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export type User = {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (u: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setUser: (user) => set({ user }),

      login: async (email, password) => {
        const { data } = await raw.post<{ access_token: string; refresh_token: string }>(
          "/auth/login",
          { email, password }
        );
        set({ accessToken: data.access_token, refreshToken: data.refresh_token });
        const me = await raw.get<User>("/api/private/me", {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        set({ user: me.data });
      },

      register: async (username, email, password) => {
        await raw.post("/auth/register", { username, email, password });
        await get().login(email, password);
      },

      fetchMe: async () => {
        const token = get().accessToken;
        if (!token) return;
        const { data } = await raw.get<User>("/api/private/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        set({ user: data });
      },

      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    {
      name: "chat-auth",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    }
  )
);
