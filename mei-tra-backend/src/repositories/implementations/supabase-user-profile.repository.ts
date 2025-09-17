/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IUserProfileRepository } from '../interfaces/user-profile.repository.interface';
import {
  UserProfile,
  UserProfileRow,
  CreateUserProfileDto,
  UpdateUserProfileDto,
  UserPreferences,
} from '../../types/user.types';

@Injectable()
export class SupabaseUserProfileRepository implements IUserProfileRepository {
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
      const { error } = await this.supabase
        .from('user_profiles')
        .update({
          games_played: gamesPlayed,
          games_won: gamesWon,
          total_score: score,
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

  private mapRowToUserProfile(row: UserProfileRow): UserProfile {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastSeenAt: new Date(row.last_seen_at),
      gamesPlayed: row.games_played,
      gamesWon: row.games_won,
      totalScore: row.total_score,
      preferences: row.preferences,
    };
  }
}
