import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
  @Get('museums/:museumId/heatmap')
  @Roles('museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Artifact engagement heatmap — weighted composite score' })
  async getHeatmap(
    @Param('museumId', ParseUUIDPipe) museumId: string,
    @Query() query: HeatmapQueryDto,
  ) {
    const to   = query.to   ? new Date(query.to)   : new Date();
    const from = query.from ? new Date(query.from)  : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.analyticsService.getHeatmap(museumId, from, to);
  }

  // S7-14
  @Get('museums/:museumId/funnels')
  @Roles('museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Visitor journey funnel analysis — 5 standard funnels with conversion rates' })
  async getFunnels(
    @Param('museumId', ParseUUIDPipe) museumId: string,
    @Query() query: FunnelQueryDto,
  ) {
    const to   = query.to   ? new Date(query.to)   : new Date();
    const from = query.from ? new Date(query.from)  : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.analyticsService.getFunnels(museumId, from, to);
  }
}
