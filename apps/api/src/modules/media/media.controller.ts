import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresignDto } from './dto/presign.dto';
import { MediaService } from './media.service';

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // ── POST /media/presign (S3-08) — content_editor+ ────────────────────────

  @Roles('content_editor', 'museum_admin', 'super_admin')
  @Post('presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a pre-signed S3 upload URL (client uploads directly)' })
  @ApiResponse({ status: 200, description: 'Returns { uploadUrl, fields, cdnUrl, expiresIn }.' })
  @ApiResponse({ status: 400, description: 'File type or size validation failed.' })
  presign(@Body() dto: PresignDto, @CurrentUser() actor: JwtPayload) {
    return this.mediaService.presign(dto, actor);
  }

  // ── DELETE /media/:key — museum_admin+ ────────────────────────────────────

  @Roles('museum_admin', 'super_admin')
  @Delete('*')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a media asset from S3 by its key (slashes allowed in key)' })
  @ApiResponse({ status: 200, description: 'Asset deleted.' })
  deleteAsset(@Param('0') key: string, @CurrentUser() actor: JwtPayload) {
    return this.mediaService.deleteAsset(key, actor);
  }
}
