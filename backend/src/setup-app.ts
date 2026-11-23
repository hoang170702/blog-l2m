import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import type { AppEnv } from './config/env.js';
import { UploadsService } from './uploads/uploads.service.js';

/** HTTP pipeline shared by main.ts and the e2e tests. */
export function setupApp(app: NestExpressApplication) {
  const config = app.get(ConfigService<AppEnv, true>);
  // Trust private-network proxies (Nginx, Traefik) so client IPs reach the rate limiter.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(helmet());
  app.use(cookieParser());
  // Express defaults to 100 kB; post content may be up to 200 000 characters (multi-byte).
  app.useBodyParser('json', { limit: '1mb' });
  const origins = config
    .get('CORS_ORIGIN', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true });
  }
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );
  // In production Nginx serves /uploads directly; this keeps native development simple.
  app.useStaticAssets(app.get(UploadsService).directory, {
    prefix: '/uploads/',
    index: false,
    dotfiles: 'deny',
  });
  app.enableShutdownHooks();
}
