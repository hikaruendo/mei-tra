import { Module } from '@nestjs/common';
import { RepositoriesModule } from './repositories/repositories.module';
import { ChatService } from './services/chat.service';
import { ChatCleanupService } from './services/chat-cleanup.service';
import { SocialGateway } from './social.gateway';

@Module({
  imports: [RepositoriesModule],
  providers: [ChatService, ChatCleanupService, SocialGateway],
  exports: [ChatService],
})
export class SocialModule {}
