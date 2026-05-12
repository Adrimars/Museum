import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BulkGenerateQrDto } from './dto/bulk-generate-qr.dto';
import { ValidateQrDto } from './dto/validate-qr.dto';
import { QrService } from './qr.service';

@ApiTags('QR Codes')
@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  // ── POST /qr/validate — public scan validation (PRD §8.4.2) ──────────────

  @Public()
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a scanned QR code and return artifact data' })
  @ApiResponse({ status: 200, description: 'Valid QR — returns artifact.' })
  @ApiResponse({ status: 400, description: 'Invalid HMAC signature.' })
  @ApiResponse({ status: 404, description: 'QR code not found.' })
  @ApiResponse({ status: 410, description: 'QR code has been deactivated.' })
  validate(@Body() dto: ValidateQrDto) {
    return this.qrService.validate(dto.codeHash, dto.kid);
  }

  // ── GET /qr/:id — view QR record (content_editor+) (PRD §8.4.4) ──────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @Get(':id')
  @ApiOperation({ summary: 'Get QR code record by ID' })
  @ApiResponse({ status: 200, description: 'QR code record.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.qrService.findById(id);
  }

  // ── PATCH /qr/:id/deactivate — museum_admin+ (PRD §8.4.4) ────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('museum_admin', 'super_admin')
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a QR code (scans return 410 Gone)' })
  @ApiResponse({ status: 200, description: 'QR code deactivated.' })
  @ApiResponse({ status: 403, description: 'QR code belongs to a different museum.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.qrService.deactivate(id, actor);
  }

  // ── POST /qr/bulk-generate — museum_admin+ (PRD §8.4.4) ──────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('museum_admin', 'super_admin')
  @Post('bulk-generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger async bulk QR generation for all active museum artifacts',
  })
  @ApiResponse({ status: 202, description: 'Job accepted. Returns jobId for status polling.' })
  @ApiResponse({ status: 403, description: 'museumId belongs to a different museum.' })
  bulkGenerate(
    @Body() dto: BulkGenerateQrDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.qrService.bulkGenerate(dto, actor);
  }

  // ── GET /qr/bulk-generate/:jobId — museum_admin+ ─────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('museum_admin', 'super_admin')
  @Get('bulk-generate/:jobId')
  @ApiOperation({ summary: 'Check bulk QR generation job status and get download URL' })
  @ApiResponse({ status: 200, description: 'Job status with optional downloadUrl.' })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  getBulkGenerateResult(
    @Param('jobId') jobId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.qrService.getBulkGenerateResult(jobId, actor);
  }
}
