import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  setAuth: (token: string, userId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      userId: null,
      setAuth: (accessToken, userId) => set({ accessToken, userId }),
      clearAuth: () => set({ accessToken: null, userId: null }),
    }),
    { name: 'mq-auth' },
  ),
);
