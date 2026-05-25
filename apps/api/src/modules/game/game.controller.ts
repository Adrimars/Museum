import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GameService } from './game.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ScanClueDto } from './dto/scan-clue.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { VerifyFinalCodeDto } from './dto/verify-final-code.dto';
import type { GuestTokenResponseDto } from './dto/guest-token.dto';
import type { SessionStateDto } from './dto/session-state.dto';

@ApiTags('game')
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  // ── Guest Token ────────────────────────────────────────────────────────────

  @Post('guest-token')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue a guest JWT for anonymous game play (no DB user record)' })
  issueGuestToken(): GuestTokenResponseDto {
    return this.gameService.issueGuestToken();
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  @Post('sessions')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new game session for a published scenario' })
  createSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionStateDto> {
    const { userId, guestJti } = this.extractActor(user);
    return this.gameService.createSession(dto, userId, guestJti);
  }

  @Get('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve current state of a game session' })
  getSession(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionStateDto> {
    const { userId, guestJti } = this.extractActor(user);
    return this.gameService.getSession(sessionId, userId, guestJti);
  }

  @Post('sessions/:id/scan')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a scanned QR code against the current clue (S5-03)' })
  scanClue(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: ScanClueDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionStateDto> {
    const { userId, guestJti } = this.extractActor(user);
    return this.gameService.scanClue(sessionId, dto, userId, guestJti);
  }

  @Post('sessions/:id/answer')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an answer for the current clue question (S5-04/S5-05/S5-06)' })
  submitAnswer(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: SubmitAnswerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionStateDto> {
    const { userId, guestJti } = this.extractActor(user);
    return this.gameService.submitAnswer(sessionId, dto, userId, guestJti);
  }

  @Post('sessions/:id/verify-final-code')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the final code to complete the treasure hunt (S5-07)' })
  verifyFinalCode(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: VerifyFinalCodeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionStateDto> {
    const { userId, guestJti } = this.extractActor(user);
    return this.gameService.verifyFinalCode(sessionId, dto, userId, guestJti);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private extractActor(user: JwtPayload): { userId: string | null; guestJti: string | null } {
    return {
      userId: user.role === 'guest' ? null : user.sub,
      guestJti: user.role === 'guest' ? (user.jti ?? null) : null,
    };
  }
}
