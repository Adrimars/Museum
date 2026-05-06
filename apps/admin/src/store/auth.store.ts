import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { api } from '@/lib/api';
import { tokenRegistry } from '@/lib/token-registry';

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
        const { data: envelope } = await api.post<{ data: { accessToken: string } }>('/auth/login', credentials);
        tokenRegistry.setToken(envelope.data.accessToken);
        set({ accessToken: envelope.data.accessToken, isAuthenticated: true });
        try {
          const { data: profileEnvelope } = await api.get<{ data: AuthUser }>('/users/me');
          set({ user: profileEnvelope.data });
        } catch {
          // Non-fatal — token is set, profile load can fail silently
        }
      },

      logout: async () => {
        tokenRegistry.setToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
        try {
          await api.post('/auth/logout');
        } catch {
          // Ignore — state already cleared
        }
      },

      clearAuth: () => {
        tokenRegistry.setToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'admin-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          tokenRegistry.setToken(state.accessToken);
        }
      },
    },
  ),
);

// Wire up clearAuth handler for 401 responses
tokenRegistry.setClearAuth(() => useAuthStore.getState().clearAuth());
