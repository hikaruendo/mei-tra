/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import {
  AccountDeletionBlocker,
  AccountDeletionCleanupResult,
  AccountDeletionRpcResult,
  IAccountDeletionRepository,
  IUserProfileRepository,
} from '../interfaces/user-profile.repository.interface';
import {
  UserProfile,
  UserProfileRow,
  CreateUserProfileDto,
  UpdateUserProfileDto,
  UserPreferences,
  ChatProfileDto,
} from '../../types/user.types';
import { RoomStatus } from '../../types/room.types';

const ACTIVE_ACCOUNT_ROOM_STATUSES = [
  RoomStatus.WAITING,
  RoomStatus.READY,
  RoomStatus.PLAYING,
];
interface DeletableJoinedRoomPlayerRow {
  id: string;
  room_id: string;
  rooms?:
    | { status?: RoomStatus; host_seat_id?: string | null }
    | { status?: RoomStatus; host_seat_id?: string | null }[];
}

@Injectable()
export class SupabaseUserProfileRepository
  implements IUserProfileRepository, IAccountDeletionRepository
{
  private readonly logger = new Logger(SupabaseUserProfileRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    // Return typed client, but cast for database operations due to strict typing issues
    return this.supabaseService.client as any;
  }

  async findById(id: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        throw error;
      }

      return this.mapRowToUserProfile(data);
    } catch (error) {
      this.logger.error(`Failed to find user profile by id ${id}:`, error);
      throw error;
    }
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        throw error;
      }

      return this.mapRowToUserProfile(data);
    } catch (error) {
      this.logger.error(
        `Failed to find user profile by username ${username}:`,
        error,
      );
      throw error;
    }
  }

  async create(id: string, data: CreateUserProfileDto): Promise<UserProfile> {
    try {
      const defaultPreferences: UserPreferences = {
        notifications: true,
        sound: true,
        theme: 'light',
        fontSize: 'standard',
        startPlayerAnimation: true,
      };

      const insertData = {
        id,
        username: data.username,
        display_name: data.displayName,
        avatar_url: data.avatarUrl || null,
        preferences: { ...defaultPreferences, ...data.preferences },
      };

      const { data: result, error } = await this.supabase
        .from('user_profiles')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to create user profile:`, error);
        throw error;
      }

      return this.mapRowToUserProfile(result);
    } catch (error) {
      this.logger.error(`Failed to create user profile:`, error);
      throw error;
    }
  }

  async update(id: string, data: UpdateUserProfileDto): Promise<UserProfile> {
    try {
      const updateData: Record<string, unknown> = {};

      if (data.username !== undefined) updateData.username = data.username;
      if (data.displayName !== undefined)
        updateData.display_name = data.displayName;
      if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;
      if (data.preferences !== undefined) {
        // Merge with existing preferences
        const existingProfile = await this.findById(id);
        if (existingProfile) {
          updateData.preferences = {
            ...existingProfile.preferences,
            ...data.preferences,
          };
        } else {
          updateData.preferences = data.preferences;
        }
      }

      const { data: result, error } = await this.supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to update user profile ${id}:`, error);
        throw error;
      }

      return this.mapRowToUserProfile(result);
    } catch (error) {
      this.logger.error(`Failed to update user profile ${id}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error(`Failed to delete user profile ${id}:`, error);
        throw error;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete user profile ${id}:`, error);
      return false;
    }
  }

  async updateLastSeen(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        this.logger.error(`Failed to update last seen for user ${id}:`, error);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to update last seen for user ${id}:`, error);
      throw error;
    }
  }

  async updateGameStats(
    id: string,
    gamesPlayed: number,
    gamesWon: number,
    score: number,
  ): Promise<void> {
    try {
      const normalizedScore = Number(score);

      const { error } = await this.supabase
        .from('user_profiles')
        .update({
          games_played: gamesPlayed,
          games_won: gamesWon,
          total_score: normalizedScore,
        })
        .eq('id', id);

      if (error) {
        this.logger.error(`Failed to update game stats for user ${id}:`, error);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to update game stats for user ${id}:`, error);
      throw error;
    }
  }

  async findByUserIds(userIds: string[]): Promise<ChatProfileDto[]> {
    try {
      if (userIds.length === 0) {
        return [];
      }

      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      if (error) {
        this.logger.error('Failed to find users by ids:', error);
        throw error;
      }

      return (
        data?.map(
          (row: { id: string; display_name: string; avatar_url?: string }) => ({
            userId: row.id,
            displayName: row.display_name,
            avatarUrl: row.avatar_url || undefined,
            rankTier: undefined,
            countryCode: undefined,
          }),
        ) || []
      );
    } catch (error) {
      this.logger.error('Failed to find users by ids:', error);
      throw error;
    }
  }

  async searchByUsername(query: string, limit = 10): Promise<UserProfile[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(limit);

      if (error) {
        this.logger.error(
          `Failed to search users by username ${query}:`,
          error,
        );
        throw error;
      }

      return (
        data?.map((row) => this.mapRowToUserProfile(row as UserProfileRow)) ||
        []
      );
    } catch (error) {
      this.logger.error(`Failed to search users by username ${query}:`, error);
      throw error;
    }
  }

  async findAccountDeletionBlockers(
    userId: string,
  ): Promise<AccountDeletionBlocker[]> {
    try {
      const { data: participantRows, error: participantError } =
        await this.supabase
          .from('room_players')
          .select(
            'id, room_id, rooms!room_players_room_id_fkey!inner(status, host_seat_id)',
          )
          .eq('user_id', userId)
          .in('rooms.status', ACTIVE_ACCOUNT_ROOM_STATUSES);

      if (participantError) {
        throw participantError;
      }

      const blockersByKey = new Map<string, AccountDeletionBlocker>();

      for (const row of (participantRows ??
        []) as DeletableJoinedRoomPlayerRow[]) {
        const status = this.extractJoinedRoomStatus(row);
        if (!status) {
          continue;
        }
        const joinedRoom = Array.isArray(row.rooms) ? row.rooms[0] : row.rooms;
        const reason =
          row.id && joinedRoom?.host_seat_id === row.id
            ? 'host'
            : 'participant';
        blockersByKey.set(`${reason}:${row.room_id}`, {
          roomId: row.room_id,
          status,
          reason,
        });
      }

      return [...blockersByKey.values()];
    } catch (error) {
      this.logger.error(
        `Failed to inspect active account deletion blockers for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async anonymizeAccountReferences(
    userId: string,
  ): Promise<AccountDeletionCleanupResult> {
    try {
      const { data, error } = await this.supabase.rpc(
        'anonymize_account_references',
        { p_user_id: userId },
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('Account anonymization RPC returned no cleanup result');
      }

      const result = data as AccountDeletionRpcResult;

      return {
        anonymizedRoomPlayerCount: Number(result.anonymized_room_player_count),
        anonymizedRoomCount: Number(result.anonymized_room_count),
        anonymizedGameStateCount: Number(result.anonymized_game_state_count),
        anonymizedGameHistoryCount: Number(
          result.anonymized_game_history_count,
        ),
      };
    } catch (error) {
      this.logger.error(
        `Failed to anonymize account references for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async markAccountDeletionStarted(
    userId: string,
  ): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase.rpc(
        'mark_account_deletion_started',
        { p_user_id: userId },
      );

      if (error) {
        throw error;
      }

      if (data) {
        return this.mapRowToUserProfile(data as UserProfileRow);
      }

      return this.findById(userId);
    } catch (error) {
      this.logger.error(
        `Failed to mark account deletion started for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async isAccountActive(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .is('account_deletion_started_at', null)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return Boolean(data);
    } catch (error) {
      this.logger.error(
        `Failed to inspect account active status for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  private mapRowToUserProfile(row: UserProfileRow): UserProfile {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastSeenAt: new Date(row.last_seen_at),
      accountDeletionStartedAt: row.account_deletion_started_at
        ? new Date(row.account_deletion_started_at)
        : undefined,
      gamesPlayed: Number(row.games_played),
      gamesWon: Number(row.games_won),
      totalScore: Number(row.total_score),
      preferences: row.preferences,
    };
  }

  private extractJoinedRoomStatus(
    row: DeletableJoinedRoomPlayerRow,
  ): RoomStatus | null {
    const joinedRoom = Array.isArray(row.rooms) ? row.rooms[0] : row.rooms;
    return joinedRoom?.status ?? null;
  }
}
