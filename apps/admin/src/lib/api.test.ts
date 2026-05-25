import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenRegistry } from './token-registry';

const requestHandlers: Array<(config: { headers: Record<string, string> }) => unknown> = [];
const responseHandlers: Array<{ rejected?: (error: unknown) => Promise<unknown> }> = [];

const mockApi = {
  interceptors: {
    request: {
      use: vi.fn((fulfilled: (config: { headers: Record<string, string> }) => unknown) => {
        requestHandlers.push(fulfilled);
        return 0;
      }),
    },
    response: {
      use: vi.fn((_fulfilled: unknown, rejected: (error: unknown) => Promise<unknown>) => {
        responseHandlers.push({ rejected });
        return 0;
      }),
    },
  },
};

const axiosCreate = vi.fn(() => mockApi);
const isAxiosError = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: axiosCreate,
    isAxiosError,
  },
}));

import { api } from './api';

describe('api', () => {
  beforeEach(() => {
    tokenRegistry.setToken(null);
    tokenRegistry.setClearAuth(() => undefined);
    isAxiosError.mockReset();
  });

  it('creates the axios client with default options', () => {
    expect(api).toBe(mockApi);
    expect(axiosCreate).toHaveBeenCalledWith({
      baseURL: '/api/v1',
      withCredentials: true,
    });
  });

  it('adds authorization header when a token exists', () => {
    tokenRegistry.setToken('token-123');

    const config = { headers: {} as Record<string, string> };
    requestHandlers[0](config);

    expect(config.headers.Authorization).toBe('Bearer token-123');
  });

  it('leaves authorization header untouched when no token exists', () => {
    const config = { headers: {} as Record<string, string> };
    requestHandlers[0](config);

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('clears auth when a 401 response is received', async () => {
    const clearAuth = vi.fn();
    tokenRegistry.setClearAuth(clearAuth);
    isAxiosError.mockReturnValue(true);

    const error = { response: { status: 401 } };

    await expect(responseHandlers[0].rejected!(error)).rejects.toBe(error);
    expect(clearAuth).toHaveBeenCalledTimes(1);
  });

  it('does not clear auth for non-401 errors', async () => {
    const clearAuth = vi.fn();
    tokenRegistry.setClearAuth(clearAuth);
    isAxiosError.mockReturnValue(true);

    const error = { response: { status: 500 } };

    await expect(responseHandlers[0].rejected!(error)).rejects.toBe(error);
    expect(clearAuth).not.toHaveBeenCalled();
  });
});
