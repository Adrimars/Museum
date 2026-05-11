import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { QrModule } from '../qr/qr.module';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactsService } from './artifacts.service';
import { EmbeddingService, ARTIFACT_EMBEDDING_QUEUE } from './embedding.service';
import { ArtifactEmbeddingProcessor } from './processors/artifact-embedding.processor';

@Module({
  imports: [
    QrModule,
    BullModule.registerQueue({ name: ARTIFACT_EMBEDDING_QUEUE }),
  ],
  controllers: [ArtifactsController],
  providers: [ArtifactsService, EmbeddingService, ArtifactEmbeddingProcessor],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
