import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RewardsModule } from '../rewards/rewards.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, RewardsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
