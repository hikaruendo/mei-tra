import { Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game.module';
import { DatabaseModule } from './database/database.module';
import { UserProfileController } from './controllers/user-profile.controller';
import { RepositoriesModule } from './repositories/repositories.module';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env.local', '.env'],
    }),
    DatabaseModule,
    GameModule,
    RepositoriesModule,
  ],
  controllers: [AppController, UserProfileController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter as unknown as Type<unknown>,
    },
    AppService,
  ],
})
export class AppModule {}
