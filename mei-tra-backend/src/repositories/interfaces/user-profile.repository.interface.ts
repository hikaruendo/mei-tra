import {
  UserProfile,
  CreateUserProfileDto,
  UpdateUserProfileDto,
  ChatProfileDto,
} from '../../types/user.types';
import { RoomStatus } from '../../types/room.types';

export interface AccountDeletionBlocker {
  roomId: string;
  status: RoomStatus;
  reason: 'participant' | 'host';
}

export interface AccountDeletionCleanupResult {
  anonymizedRoomPlayerCount: number;
  anonymizedRoomCount: number;
  anonymizedGameStateCount: number;
  anonymizedGameHistoryCount: number;
}

export interface AccountDeletionRpcResult {
  anonymized_room_player_count: number;
  anonymized_room_count: number;
  anonymized_game_state_count: number;
  anonymized_game_history_count: number;
}

export interface IUserProfileRepository {
  findById(id: string): Promise<UserProfile | null>;
  findByUsername(username: string): Promise<UserProfile | null>;
  findByUserIds(userIds: string[]): Promise<ChatProfileDto[]>;
  create(id: string, data: CreateUserProfileDto): Promise<UserProfile>;
  update(id: string, data: UpdateUserProfileDto): Promise<UserProfile>;
  delete(id: string): Promise<boolean>;
  updateLastSeen(id: string): Promise<void>;
  updateGameStats(
    id: string,
    gamesPlayed: number,
    gamesWon: number,
    score: number,
  ): Promise<void>;
  searchByUsername(query: string, limit?: number): Promise<UserProfile[]>;
}

export interface IAccountDeletionRepository {
  findAccountDeletionBlockers(
    userId: string,
  ): Promise<AccountDeletionBlocker[]>;
  markAccountDeletionStarted(userId: string): Promise<UserProfile | null>;
  anonymizeAccountReferences(
    userId: string,
  ): Promise<AccountDeletionCleanupResult>;
}

export interface IAccountStatusRepository {
  isAccountActive(userId: string): Promise<boolean>;
}
