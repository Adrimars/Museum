import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';
import { Roles } from '../../common/decorators/roles.decorator';

import { AnalyticsService } from './analytics.service';
import { FunnelQueryDto } from './dto/funnel-query.dto';
import { HeatmapQueryDto } from './dto/heatmap-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // S7-13
  // S-10: content_editor added — PRD §7.2 grants them read-only analytics access (👁️)
  @Get('museums/:museumId/heatmap')
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Artifact engagement heatmap — weighted composite score' })
  async getHeatmap(
    @Param('museumId', ParseUUIDPipe) museumId: string,
    @Query() query: HeatmapQueryDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    // S-10: content_editor and museum_admin are scoped to their own museum
    this.assertMuseumReadScope(actor, museumId);
    const to   = query.to   ? new Date(query.to)   : new Date();
    const from = query.from ? new Date(query.from)  : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.analyticsService.getHeatmap(museumId, from, to);
  }

  // S7-14
  // S-10: content_editor added — PRD §7.2 grants them read-only analytics access (👁️)
  @Get('museums/:museumId/funnels')
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Visitor journey funnel analysis — 5 standard funnels with conversion rates' })
  async getFunnels(
    @Param('museumId', ParseUUIDPipe) museumId: string,
    @Query() query: FunnelQueryDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    // S-10: content_editor and museum_admin are scoped to their own museum
    this.assertMuseumReadScope(actor, museumId);
    const to   = query.to   ? new Date(query.to)   : new Date();
    const from = query.from ? new Date(query.from)  : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.analyticsService.getFunnels(museumId, from, to);
  }

  // S-10: super_admin may read any museum; everyone else is restricted to their own
  private assertMuseumReadScope(actor: JwtPayload, targetMuseumId: string): void {
    if (actor.role === 'super_admin') return;
    if (actor.museumId !== targetMuseumId) {
      throw new ForbiddenException({
        message: 'You can only view analytics for your own museum.',
        errorCode: ErrorCode.FORBIDDEN,
      });
    }
  }
}
