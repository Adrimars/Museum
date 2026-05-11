import { Module } from '@nestjs/common';

import { QrModule } from '../qr/qr.module';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactsService } from './artifacts.service';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [QrModule],
  controllers: [ArtifactsController],
  providers: [ArtifactsService, EmbeddingService],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
