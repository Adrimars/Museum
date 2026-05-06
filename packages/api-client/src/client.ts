import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

import type { ApiError } from './types';

export class MuseumQuestApiClient {
  private readonly http: AxiosInstance;

  constructor(baseURL: string, config?: AxiosRequestConfig) {
    this.http = axios.create({
      baseURL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
      ...config,
    });

    this.http.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (axios.isAxiosError(error) && error.response) {
          const apiError = error.response.data as ApiError;
          return Promise.reject(apiError);
        }
        return Promise.reject(error);
      },
    );
  }

  setAuthToken(token: string): void {
    this.http.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.http.defaults.headers.common['Authorization'];
  }

  getInstance(): AxiosInstance {
    return this.http;
  }
}
