import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
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
import { ArtifactsService } from './artifacts.service';
import { CreateArtifactDto } from './dto/create-artifact.dto';
import { ListArtifactsDto } from './dto/list-artifacts.dto';
import { UpdateArtifactDto } from './dto/update-artifact.dto';

@ApiTags('Artifacts')
@Controller()
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  // ── GET /museums/:museumId/artifacts (public, paginated, pg_trgm search) ──

  @Public()
  @Get('museums/:museumId/artifacts')
  @ApiOperation({ summary: 'List artifacts for a museum with optional text search' })
  @ApiResponse({ status: 200, description: 'Paginated artifact list.' })
  findAll(
    @Param('museumId', ParseUUIDPipe) museumId: string,
    @Query() dto: ListArtifactsDto,
  ) {
    return this.artifactsService.findAll(museumId, dto);
  }

  // ── GET /artifacts/:id (public) ───────────────────────────────────────────

  @Public()
  @Get('artifacts/:id')
  @ApiOperation({ summary: 'Get full artifact detail' })
  @ApiResponse({ status: 200, description: 'Artifact detail.' })
  @ApiResponse({ status: 404, description: 'Artifact not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.artifactsService.findOne(id);
  }

  // ── POST /artifacts (content_editor+) ────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @Post('artifacts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new artifact (triggers QR generation)' })
  @ApiResponse({ status: 201, description: 'Artifact created.' })
  @ApiResponse({ status: 403, description: 'Access denied to target museum.' })
  create(
    @Body() dto: CreateArtifactDto,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.artifactsService.create(dto, actor, ip);
  }

  // ── PATCH /artifacts/:id (content_editor+) ───────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @Patch('artifacts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update artifact fields' })
  @ApiResponse({ status: 200, description: 'Artifact updated.' })
  @ApiResponse({ status: 403, description: 'Access denied to target museum.' })
  @ApiResponse({ status: 404, description: 'Artifact not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArtifactDto,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.artifactsService.update(id, dto, actor, ip);
  }

  // ── DELETE /artifacts/:id (museum_admin+) ────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('museum_admin', 'super_admin')
  @Delete('artifacts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete an artifact and deactivate its QR code' })
  @ApiResponse({ status: 200, description: 'Artifact deleted.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Artifact not found.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.artifactsService.remove(id, actor, ip);
  }

  // ── GET /artifacts/:id/qr (content_editor+) ──────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @Get('artifacts/:id/qr')
  @ApiOperation({ summary: 'Get the QR code record for an artifact' })
  @ApiResponse({ status: 200, description: 'QR code record.' })
  @ApiResponse({ status: 404, description: 'Artifact or QR code not found.' })
  getQrCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.artifactsService.getQrCode(id, actor);
  }
}
