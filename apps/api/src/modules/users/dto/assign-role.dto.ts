import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

// super_admin cannot be assigned via this endpoint — only via direct DB / seed
export const ASSIGNABLE_ROLES = ['user', 'content_editor', 'museum_admin'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export class AssignRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES, example: 'museum_admin' })
  @IsIn(ASSIGNABLE_ROLES, {
    message: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`,
  })
  role!: AssignableRole;

  @ApiPropertyOptional({
    description: 'Required when role is museum_admin or content_editor',
    example: 'uuid-of-museum',
  })
  @IsOptional()
  @IsUUID()
  museumId?: string;
}
