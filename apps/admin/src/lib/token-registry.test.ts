import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenRegistry } from './token-registry';

describe('tokenRegistry', () => {
  beforeEach(() => {
    tokenRegistry.setToken(null);
    tokenRegistry.setClearAuth(() => undefined);
  });

  it('stores and returns tokens', () => {
    tokenRegistry.setToken('token-123');

    expect(tokenRegistry.getToken()).toBe('token-123');

    tokenRegistry.setToken(null);
    expect(tokenRegistry.getToken()).toBeNull();
  });

  it('invokes the clear auth handler', () => {
    const clearAuth = vi.fn();
    tokenRegistry.setClearAuth(clearAuth);

    tokenRegistry.clearAuth();

    expect(clearAuth).toHaveBeenCalledTimes(1);
  });
});
