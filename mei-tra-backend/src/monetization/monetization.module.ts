import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import revenuecatConfig from '../config/revenuecat.config';
import { SupabaseEntitlementsRepository } from '../repositories/implementations/supabase-entitlements.repository';
import { AppFlagsController } from './app-flags.controller';
import { AppFlagsService } from './app-flags.service';
import { EntitlementsController } from './entitlements.controller';
import {
  ENTITLEMENTS_REPOSITORY,
  EntitlementsService,
} from './entitlements.service';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ConfigModule.forFeature(revenuecatConfig),
  ],
  controllers: [
    RevenueCatWebhookController,
    EntitlementsController,
    AppFlagsController,
  ],
  providers: [
    SupabaseEntitlementsRepository,
    {
      provide: ENTITLEMENTS_REPOSITORY,
      useExisting: SupabaseEntitlementsRepository,
    },
    EntitlementsService,
    AppFlagsService,
  ],
  exports: [EntitlementsService],
})
export class MonetizationModule {}
