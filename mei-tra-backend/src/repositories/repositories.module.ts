import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SupabaseRoomRepository } from './implementations/supabase-room.repository';
import { SupabaseGameStateRepository } from './implementations/supabase-game-state.repository';

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
  ],
  exports: ['IRoomRepository', 'IGameStateRepository'],
})
export class RepositoriesModule {}
