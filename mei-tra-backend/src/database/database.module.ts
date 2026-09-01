import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './supabase.service';
import supabaseConfig from '../config/supabase.config';
import { SupabaseAvatarStorage } from '../storage/supabase-avatar-storage';

@Module({
  imports: [ConfigModule.forFeature(supabaseConfig)],
  providers: [
    SupabaseService,
    {
      provide: 'IAvatarStorage',
      useClass: SupabaseAvatarStorage,
    },
  ],
  exports: [SupabaseService, 'IAvatarStorage'],
})
export class DatabaseModule {}
