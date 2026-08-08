import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SupabasePushTokenRepository } from '../repositories/implementations/supabase-push-token.repository';
import {
  EXPO_PUSH_CLIENT,
  PUSH_TOKEN_REPOSITORY,
  PushNotificationService,
} from './push-notification.service';
import { ExpoPushClient } from './expo-push.client';
import { PushTokenController } from './push-token.controller';
import { PushReceiptService } from './push-receipt.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PushTokenController],
  providers: [
    SupabasePushTokenRepository,
    {
      provide: PUSH_TOKEN_REPOSITORY,
      useExisting: SupabasePushTokenRepository,
    },
    ExpoPushClient,
    {
      provide: EXPO_PUSH_CLIENT,
      useExisting: ExpoPushClient,
    },
    PushReceiptService,
    PushNotificationService,
  ],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}
