import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Import at call-time to avoid circular dep at module init
  const { useAuthStore } = require('@/store/auth.store') as typeof import('@/store/auth.store');
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const { useAuthStore } = require('@/store/auth.store') as typeof import('@/store/auth.store');
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);
