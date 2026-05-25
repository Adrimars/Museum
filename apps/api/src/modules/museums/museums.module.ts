import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';

import { MuseumTenantMiddleware } from '../../common/middleware/museum-tenant.middleware';

import { MuseumsController } from './museums.controller';
import { MuseumsService } from './museums.service';

@Module({
  controllers: [MuseumsController],
  providers: [MuseumsService],
  exports: [MuseumsService],
})
export class MuseumsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant middleware to museum-scoped routes that carry a museumId param
    consumer
      .apply(MuseumTenantMiddleware)
      .forRoutes(
        { path: 'museums/:id/activate', method: RequestMethod.PATCH },
        { path: 'museums/:id/deactivate', method: RequestMethod.PATCH },
      );
  }
}
