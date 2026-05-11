import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { QrBulkGenerateProcessor, QR_BULK_GENERATE_QUEUE } from './processors/qr-bulk-generate.processor';

@Module({
  imports: [
    StorageModule,
    BullModule.registerQueue({ name: QR_BULK_GENERATE_QUEUE }),
  ],
  controllers: [QrController],
  providers: [QrService, QrBulkGenerateProcessor],
  exports: [QrService],
})
export class QrModule {}
