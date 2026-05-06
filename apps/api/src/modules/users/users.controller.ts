import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}
