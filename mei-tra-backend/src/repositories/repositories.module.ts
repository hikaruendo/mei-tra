import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SupabaseRoomRepository } from './implementations/supabase-room.repository';
import { SupabaseGameStateRepository } from './implementations/supabase-game-state.repository';
import { SupabaseUserProfileRepository } from './implementations/supabase-user-profile.repository';
import { SupabaseProfileRepository } from './implementations/supabase-profile.repository';
import { SupabaseChatRoomRepository } from './implementations/supabase-chat-room.repository';
import { SupabaseChatMessageRepository } from './implementations/supabase-chat-message.repository';
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
    {
      provide: 'IProfileRepository',
      useClass: SupabaseProfileRepository,
    },
    {
      provide: 'IChatRoomRepository',
      useClass: SupabaseChatRoomRepository,
    },
    {
      provide: 'IChatMessageRepository',
      useClass: SupabaseChatMessageRepository,
    },
  ],
  exports: [
    'SUPABASE_CLIENT',
    'IRoomRepository',
    'IGameStateRepository',
    'IUserProfileRepository',
    'IProfileRepository',
    'IChatRoomRepository',
    'IChatMessageRepository',
  ],
})
export class RepositoriesModule {}
