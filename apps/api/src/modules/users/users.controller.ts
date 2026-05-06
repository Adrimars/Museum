import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AssignRoleDto } from './dto/assign-role.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── GET /users (museum_admin own | super_admin all) ─────────────────────

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles('museum_admin', 'super_admin')
  @ApiOperation({ summary: 'List users with cursor pagination (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated user list (no passwordHash).' })
  @ApiResponse({ status: 403, description: 'Insufficient role.' })
  findAll(@Query() dto: ListUsersDto, @CurrentUser() actor: JwtPayload) {
    return this.usersService.findAll(dto, actor.role, actor.museumId);
  }

  // ── GET /me ─────────────────────────────────────────────────────────────

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile (no passwordHash).' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }

  // ── PATCH /me ────────────────────────────────────────────────────────────

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Updated user profile.' })
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  // ── PATCH /users/:id/role (super_admin only) ─────────────────────────────

  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Assign role to a user (super_admin only)' })
  @ApiResponse({ status: 200, description: 'User role updated.' })
  @ApiResponse({ status: 400, description: 'museumId required for museum_admin/content_editor, or self-change attempted.' })
  @ApiResponse({ status: 403, description: 'Insufficient role.' })
  @ApiResponse({ status: 404, description: 'User or museum not found.' })
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(id, actor.sub, dto);
  }
}
