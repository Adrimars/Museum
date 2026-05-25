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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { CreateScenarioDto } from './dto/create-scenario.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import type { GuestTokenResponseDto } from './dto/guest-token.dto';
import { ListScenariosDto } from './dto/list-scenarios.dto';
import { ScanClueDto } from './dto/scan-clue.dto';
import type { SessionStateDto } from './dto/session-state.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { VerifyFinalCodeDto } from './dto/verify-final-code.dto';
import { GameService } from './game.service';

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

  // ── Scenario CRUD (admin, S5-10) ───────────────────────────────────────────

  @Get('scenarios')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List game scenarios (published only for visitors, all statuses for admins)' })
  listScenarios(
    @Query() query: ListScenariosDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.gameService.listScenarios(query, user);
  }

  @Get('scenarios/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single game scenario' })
  getScenario(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.gameService.getScenario(id, user);
  }

  @Post('scenarios')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Create a new game scenario in draft status (S5-10)' })
  createScenario(
    @Body() dto: CreateScenarioDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.gameService.createScenario(dto, user, ip);
  }

  @Patch('scenarios/:id')
  @ApiBearerAuth()
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Update a game scenario' })
  updateScenario(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScenarioDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.gameService.updateScenario(id, dto, user, ip);
  }

  @Patch('scenarios/:id/publish')
  @ApiBearerAuth()
  @Roles('museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Publish a scenario — makes it visible to visitors (S5-10)' })
  publishScenario(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.gameService.publishScenario(id, user, ip);
  }

  @Patch('scenarios/:id/unpublish')
  @ApiBearerAuth()
  @Roles('museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Revert a scenario to draft (hides it from visitors)' })
  unpublishScenario(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.gameService.unpublishScenario(id, user, ip);
  }

  @Delete('scenarios/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Soft-delete a game scenario' })
  async deleteScenario(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ): Promise<void> {
    await this.gameService.deleteScenario(id, user, ip);
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
