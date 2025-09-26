import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game.module';
import { DatabaseModule } from './database/database.module';
import { UserProfileController } from './controllers/user-profile.controller';
import { RepositoriesModule } from './repositories/repositories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env.local', '.env'],
    }),
    DatabaseModule,
    GameModule,
    RepositoriesModule,
  ],
  controllers: [AppController, UserProfileController],
  providers: [AppService],
})
export class AppModule {}
