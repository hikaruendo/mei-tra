import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RepositoriesModule } from './repositories/repositories.module';
import { ChatService } from './services/chat.service';
import { ChatCleanupService } from './services/chat-cleanup.service';
import { SocialGateway } from './social.gateway';
import { ChatController } from './controllers/chat.controller';

@Module({
  imports: [RepositoriesModule, ScheduleModule.forRoot()],
  controllers: [ChatController],
  providers: [ChatService, ChatCleanupService, SocialGateway],
  exports: [ChatService],
})
export class SocialModule {}
