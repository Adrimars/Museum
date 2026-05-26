import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

import { AiService } from './ai.service';
import { CreateChatSessionDto } from './dto/create-chat-session.dto';
import { FlagMessageDto } from './dto/flag-message.dto';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // S7-01: Create chat session
  @Post('sessions')
  @ApiOperation({ summary: 'Create a new AI chat session' })
  create(@Body() dto: CreateChatSessionDto, @CurrentUser() user: JwtPayload) {
    return this.aiService.createSession(dto, user);
  }

  // S7-01: Get session with message history
  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get AI chat session with message history' })
  @ApiParam({ name: 'id', description: 'Chat session UUID' })
  getSession(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.aiService.getSession(id, user);
  }

  // S7-07: Suggested questions — lazy, Redis-cached 24h
  @Get('artifacts/:artifactId/suggested-questions')
  @ApiOperation({ summary: 'Get suggested questions for an artifact (cached 24h)' })
  @ApiParam({ name: 'artifactId', description: 'Artifact UUID' })
  @ApiQuery({ name: 'lang', required: false, description: 'Language code (en | tr)' })
  getSuggestedQuestions(
    @Param('artifactId') artifactId: string,
    @Query('lang') lang: string = 'en',
  ) {
    return this.aiService.getSuggestedQuestions(artifactId, lang);
  }

  // S7-09: Flag / dismiss an AI message (MVP-STUB)
  @Patch('messages/:id/flag')
  @ApiOperation({ summary: '[MVP-STUB] Flag or dismiss an AI message' })
  @ApiParam({ name: 'id', description: 'AI message UUID' })
  flagMessage(
    @Param('id') id: string,
    @Body() dto: FlagMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.aiService.flagMessage(id, dto.flagStatus, user);
  }
}
