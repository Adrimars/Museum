import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { RewardsModule } from '../rewards/rewards.module';

import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

@Module({
  imports: [PrismaModule, RewardsModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
