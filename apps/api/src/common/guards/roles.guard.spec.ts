import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ErrorCode } from '../errors/error-codes';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const createContext = (user?: { role: string }): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  const createReflector = (isPublic: boolean, roles?: string[]): Reflector =>
    ({
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC_KEY) return isPublic;
        if (key === ROLES_KEY) return roles;
        return undefined;
      }),
    }) as unknown as Reflector;

  it('allows access to public routes', () => {
    const guard = new RolesGuard(createReflector(true));

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows access when no roles are required', () => {
    const guard = new RolesGuard(createReflector(false, undefined));

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('throws when user lacks required role', () => {
    const guard = new RolesGuard(createReflector(false, ['museum_admin']));
    const context = createContext({ role: 'user' });

    try {
      guard.canActivate(context);
      throw new Error('Expected guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      const response = (error as ForbiddenException).getResponse() as Record<string, string>;
      expect(response.errorCode).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('allows higher privileged roles', () => {
    const guard = new RolesGuard(createReflector(false, ['museum_admin']));
    const context = createContext({ role: 'super_admin' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies when user is missing', () => {
    const guard = new RolesGuard(createReflector(false, ['user']));

    expect(guard.canActivate(createContext())).toBe(false);
  });
});
