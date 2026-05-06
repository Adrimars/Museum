import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMuseumDto } from './dto/create-museum.dto';
import { ListMuseumsDto } from './dto/list-museums.dto';
import { UpdateMuseumDto } from './dto/update-museum.dto';
import { MuseumsService } from './museums.service';

@ApiTags('Museums')
@Controller('museums')
export class MuseumsController {
  constructor(private readonly museumsService: MuseumsService) {}

  // ── List active museums (public, cursor-based) ──────────────────────────

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all active museums (paginated, cursor-based)' })
  @ApiResponse({ status: 200, description: 'Active museum list.' })
  findAll(@Query() dto: ListMuseumsDto) {
    return this.museumsService.findAll(dto);
  }

  // ── Museum detail (public) ──────────────────────────────────────────────

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get museum details by ID' })
  @ApiResponse({ status: 200, description: 'Museum detail.' })
  @ApiResponse({ status: 404, description: 'Museum not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.museumsService.findOne(id);
  }

  // ── Create museum (super_admin only) ────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new museum (super_admin only)' })
  @ApiResponse({ status: 201, description: 'Museum created with default settings.' })
  @ApiResponse({ status: 409, description: 'Slug already taken.' })
  create(@Body() dto: CreateMuseumDto) {
    return this.museumsService.create(dto);
  }

  // ── Update museum (museum_admin own | super_admin any) ──────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('museum_admin', 'super_admin')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update museum details or settings' })
  @ApiResponse({ status: 200, description: 'Museum updated.' })
  @ApiResponse({ status: 403, description: 'museum_admin may only update their own museum.' })
  @ApiResponse({ status: 404, description: 'Museum not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMuseumDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.museumsService.update(id, dto, actor);
  }

  // ── Soft-delete museum (super_admin only) ───────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a museum (super_admin only)' })
  @ApiResponse({ status: 200, description: 'Museum deleted.' })
  @ApiResponse({ status: 404, description: 'Museum not found.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.museumsService.remove(id);
  }
}
