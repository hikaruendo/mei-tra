import { Module } from '@nestjs/common';
import { RepositoriesModule } from './repositories/repositories.module';
import { ChatService } from './services/chat.service';
import { ChatCleanupService } from './services/chat-cleanup.service';
import { SocialGateway } from './social.gateway';
import { AuthModule } from './auth/auth.module';
import { AccountActionGateService } from './services/account-action-gate.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  providers: [
    ChatService,
    ChatCleanupService,
    SocialGateway,
    AccountActionGateService,
  ],
  exports: [ChatService],
})
export class SocialModule {}
