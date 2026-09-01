import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './supabase.service';
import supabaseConfig from '../config/supabase.config';
import { SupabaseAvatarStorage } from '../storage/supabase-avatar-storage';
import { SupabaseIdentityProvider } from '../identity/supabase-identity-provider';
import { DATABASE_HEALTH } from './interfaces/database-health.interface';

@Module({
  imports: [ConfigModule.forFeature(supabaseConfig)],
  providers: [
    SupabaseService,
    {
      provide: DATABASE_HEALTH,
      useExisting: SupabaseService,
    },
    {
      provide: 'IAvatarStorage',
      useClass: SupabaseAvatarStorage,
    },
    {
      provide: 'IIdentityProvider',
      useClass: SupabaseIdentityProvider,
    },
  ],
  exports: [
    SupabaseService,
    DATABASE_HEALTH,
    'IAvatarStorage',
    'IIdentityProvider',
  ],
})
export class DatabaseModule {}
