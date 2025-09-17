import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SupabaseRoomRepository } from './implementations/supabase-room.repository';
import { SupabaseGameStateRepository } from './implementations/supabase-game-state.repository';
import { SupabaseUserProfileRepository } from './implementations/supabase-user-profile.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
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
    'IRoomRepository',
    'IGameStateRepository',
    'IUserProfileRepository',
  ],
})
export class RepositoriesModule {}
