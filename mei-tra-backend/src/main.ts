import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'development'
        ? [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:8081',
            'http://192.168.0.22:3000',
            'http://192.168.0.22:3001',
            'http://192.168.0.22:8081',
          ]
        : 'https://mei-tra-frontend.vercel.app',
    credentials: true,
  });

  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();
