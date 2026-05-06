import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin:
      process.env['NODE_ENV'] === 'production'
        ? process.env['ALLOWED_ORIGIN']
        : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor(), new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MuseumQuest API')
    .setDescription('MuseumQuest backend REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('refreshToken')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  bootstrapLogger.log(`MuseumQuest API running on http://localhost:${port}/api/v1`);
  bootstrapLogger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  bootstrapLogger.error('Failed to start application', err);
  process.exit(1);
});
