import { SetMetadata } from '@nestjs/common';

export type UserRole = 'user' | 'content_editor' | 'museum_admin' | 'super_admin';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
