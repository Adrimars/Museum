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
import { GameService } from './game.service';
import { CreateSessionDto } from './dto/create-session.dto';
import type { SessionStateDto } from './dto/session-state.dto';

@ApiTags('game')
@ApiBearerAuth()
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('sessions')
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
