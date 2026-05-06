import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { JwtPayload } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY, type UserRole } from '../decorators/roles.decorator';
import { ErrorCode } from '../errors/error-codes';

// Higher rank = more privilege
const ROLE_RANK: Record<UserRole | 'guest', number> = {
  guest: 0,
  user: 1,
  content_editor: 2,
  museum_admin: 3,
  super_admin: 4,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip if the endpoint is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — any authenticated user passes
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    // If JWT guard didn't populate user the request is already rejected upstream
    if (!user) return false;

    const userRank = ROLE_RANK[user.role as UserRole] ?? 0;
    const minimumRank = Math.min(...requiredRoles.map((r) => ROLE_RANK[r] ?? 0));

    if (userRank < minimumRank) {
      throw new ForbiddenException({
        message: 'You do not have permission to perform this action.',
        errorCode: ErrorCode.FORBIDDEN,
      });
    }

    return true;
  }
}
