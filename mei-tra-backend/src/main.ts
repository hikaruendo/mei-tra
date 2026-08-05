import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/nestjs';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { isAllowedFrontendOrigin } from './config/frontend-origins';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

async function bootstrap() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
    });
  }

  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));

  const corsOptions: CorsOptions = {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || isAllowedFrontendOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  };
  app.enableCors(corsOptions);

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3333, '0.0.0.0');
}
void bootstrap();
