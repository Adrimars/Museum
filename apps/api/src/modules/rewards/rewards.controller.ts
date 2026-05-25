import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';

import { CreateRewardDto } from './dto/create-reward.dto';
import { IssueRewardDto } from './dto/issue-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { VerifyDiscountDto } from './dto/verify-discount.dto';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  // ── Reward Definitions (S6-07) ─────────────────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Create a reward definition (S6-07)' })
  createReward(@Body() dto: CreateRewardDto) {
    return this.rewardsService.createReward(dto);
  }

  @Get()
  @ApiBearerAuth()
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'List reward definitions for a museum (S6-07)' })
  listRewards(@Query('museumId', ParseUUIDPipe) museumId: string) {
    return this.rewardsService.listRewards(museumId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Update a reward definition (S6-07)' })
  updateReward(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRewardDto) {
    return this.rewardsService.updateReward(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Roles('museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Delete a reward definition (S6-07)' })
  deleteReward(@Param('id', ParseUUIDPipe) id: string) {
    return this.rewardsService.deleteReward(id);
  }

  // ── Reward Issuance (S6-07) ────────────────────────────────────────────────

  @Post('issue')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Roles('museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Issue a reward to a user (internal; also called by GameModule/QuizModule) (S6-07/S6-08)' })
  issueReward(@Body() dto: IssueRewardDto) {
    return this.rewardsService.issueReward(dto);
  }

  // ── Discount Code Verification (S6-09) ────────────────────────────────────

  @Post(':id/verify')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Roles('content_editor', 'museum_admin', 'super_admin')
  @ApiOperation({ summary: 'Verify and redeem a discount code at the ticket desk (S6-09)' })
  verifyDiscount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyDiscountDto,
  ) {
    return this.rewardsService.verifyDiscount(id, dto);
  }
}
