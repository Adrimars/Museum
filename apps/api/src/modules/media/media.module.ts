import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';

import { MediaController } from './media.controller';
import { MediaService, IMAGE_OPTIMIZATION_QUEUE } from './media.service';
import { ImageOptimizationProcessor } from './processors/image-optimization.processor';

@Module({
  imports: [
    StorageModule,
    BullModule.registerQueue({ name: IMAGE_OPTIMIZATION_QUEUE }),
  ],
  controllers: [MediaController],
  providers: [MediaService, ImageOptimizationProcessor],
  exports: [MediaService],
})
export class MediaModule {}
