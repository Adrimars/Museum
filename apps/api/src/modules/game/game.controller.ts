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
    const userId = user.role === 'guest' ? null : user.sub;
    const guestJti = user.role === 'guest' ? (user.jti ?? null) : null;
    return this.gameService.createSession(dto, userId, guestJti);
  }

  @Get('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve current state of a game session' })
  getSession(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionStateDto> {
    const userId = user.role === 'guest' ? null : user.sub;
    const guestJti = user.role === 'guest' ? (user.jti ?? null) : null;
    return this.gameService.getSession(sessionId, userId, guestJti);
  }
}
