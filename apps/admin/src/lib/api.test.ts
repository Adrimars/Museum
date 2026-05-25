import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenRegistry } from './token-registry';

const requestHandlers = vi.hoisted(
  () => [] as Array<(config: { headers: Record<string, string> }) => unknown>,
);
const responseHandlers = vi.hoisted(
  () => [] as Array<{ rejected?: (error: unknown) => Promise<unknown> }>,
);

const mockApi = vi.hoisted(() => ({
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
}));

const axiosCreate = vi.hoisted(() => vi.fn(() => mockApi));
const isAxiosError = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    create: axiosCreate,
    isAxiosError,
  },
}));

import { api } from './api';

describe('api', () => {
  const getRequestHandler = () => {
    const handler = requestHandlers[0];
    if (!handler) {
      throw new Error('Request interceptor was not registered');
    }
    return handler;
  };

  const getResponseRejectionHandler = () => {
    const handler = responseHandlers[0]?.rejected;
    if (!handler) {
      throw new Error('Response interceptor was not registered');
    }
    return handler;
  };

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
    getRequestHandler()(config);

    expect(config.headers.Authorization).toBe('Bearer token-123');
  });

  it('leaves authorization header untouched when no token exists', () => {
    const config = { headers: {} as Record<string, string> };
    getRequestHandler()(config);

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('clears auth when a 401 response is received', async () => {
    const clearAuth = vi.fn();
    tokenRegistry.setClearAuth(clearAuth);
    isAxiosError.mockReturnValue(true);

    const error = { response: { status: 401 } };

    await expect(getResponseRejectionHandler()(error)).rejects.toBe(error);
    expect(clearAuth).toHaveBeenCalledTimes(1);
  });

  it('does not clear auth for non-401 errors', async () => {
    const clearAuth = vi.fn();
    tokenRegistry.setClearAuth(clearAuth);
    isAxiosError.mockReturnValue(true);

    const error = { response: { status: 500 } };

    await expect(getResponseRejectionHandler()(error)).rejects.toBe(error);
    expect(clearAuth).not.toHaveBeenCalled();
  });
});
