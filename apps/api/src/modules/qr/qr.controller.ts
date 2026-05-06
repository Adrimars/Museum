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

import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
  @ApiResponse({ status: 404, description: 'Not found.' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.qrService.deactivate(id);
  }
}
