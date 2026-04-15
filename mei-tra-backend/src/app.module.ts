import { Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { HealthController } from './controllers/health.controller';
import { AppService } from './app.service';
import { GameModule } from './game.module';
import { SocialModule } from './social.module';
import { AuthModule } from './auth/auth.module';
import { UserProfileController } from './controllers/user-profile.controller';
import { DatabaseModule } from './database/database.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env.development', '.env'],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    GameModule,
    SocialModule,
    RepositoriesModule,
  ],
  controllers: [AppController, HealthController, UserProfileController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter as unknown as Type<unknown>,
    },
    AppService,
  ],
})
export class AppModule {}
