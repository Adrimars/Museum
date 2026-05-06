import { Module } from '@nestjs/common';

import { QrModule } from '../qr/qr.module';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactsService } from './artifacts.service';

@Module({
  imports: [QrModule],
  controllers: [ArtifactsController],
  providers: [ArtifactsService],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
