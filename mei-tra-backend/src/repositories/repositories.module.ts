import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SupabaseRoomRepository } from './implementations/supabase-room.repository';
import { SupabaseGameStateRepository } from './implementations/supabase-game-state.repository';
import { SupabaseUserProfileRepository } from './implementations/supabase-user-profile.repository';
import { SupabaseService } from '../database/supabase.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: 'SUPABASE_CLIENT',
      useFactory: (supabaseService: SupabaseService) => supabaseService.client,
      inject: [SupabaseService],
    },
    {
      provide: 'IRoomRepository',
      useClass: SupabaseRoomRepository,
    },
    {
      provide: 'IGameStateRepository',
      useClass: SupabaseGameStateRepository,
    },
    {
      provide: 'IUserProfileRepository',
      useClass: SupabaseUserProfileRepository,
    },
  ],
  exports: [
    'SUPABASE_CLIENT',
    'IRoomRepository',
    'IGameStateRepository',
    'IUserProfileRepository',
  ],
})
export class RepositoriesModule {}
