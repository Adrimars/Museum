import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { api } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (credentials) => {
        const { data } = await api.post<{ accessToken: string }>('/auth/login', credentials);
        set({ accessToken: data.accessToken, isAuthenticated: true });
        try {
          const { data: user } = await api.get<AuthUser>('/users/me');
          set({ user });
        } catch {
          // Non-fatal — token is set, profile load can fail silently
        }
      },

      logout: async () => {
        set({ user: null, accessToken: null, isAuthenticated: false });
        try {
          await api.post('/auth/logout');
        } catch {
          // Ignore — state already cleared
        }
      },

      clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'admin-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
