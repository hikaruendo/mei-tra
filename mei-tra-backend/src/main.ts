import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3000', 'https://mei-tra-frontend.vercel.app'],
  });

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
