/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IProfileRepository } from '../interfaces/profile.repository.interface';
import { Profile, UserId } from '../../types/social.types';

@Injectable()
export class SupabaseProfileRepository implements IProfileRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findByUserId(userId: UserId): Promise<Profile | null> {
    const { data, error } = await this.supabase.client
      .from('user_profiles')
      .select('*')
      .eq('id', userId.getValue())
      .single();

    if (error || !data) {
      return null;
    }

    return this.toDomain(data);
  }

  async findByUserIds(userIds: UserId[]): Promise<Profile[]> {
    if (userIds.length === 0) {
      return [];
    }

    const ids = userIds.map((id) => id.getValue());
    const { data, error } = await this.supabase.client
      .from('user_profiles')
      .select('*')
      .in('id', ids);

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.toDomain(row));
  }

  async findByDisplayName(displayName: string): Promise<Profile[]> {
    const { data, error } = await this.supabase.client
      .from('user_profiles')
      .select('*')
      .ilike('display_name', `%${displayName}%`);

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.toDomain(row));
  }

  async create(profile: Profile): Promise<Profile> {
    const row = this.toRow(profile);
    const { data, error } = await this.supabase.client
      .from('user_profiles')
      .insert(row as any)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create profile: ${error?.message}`);
    }

    return this.toDomain(data);
  }

  async update(profile: Profile): Promise<Profile> {
    const row = this.toRow(profile);
    const { data, error } = await (
      this.supabase.client.from('user_profiles') as any
    )
      .update(row)
      .eq('id', profile.getUserId().getValue())
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update profile: ${error?.message}`);
    }

    return this.toDomain(data);
  }

  async updateLastOnline(userId: UserId): Promise<void> {
    const { error } = await (this.supabase.client.from('user_profiles') as any)
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId.getValue());

    if (error) {
      throw new Error(`Failed to update last online: ${error.message}`);
    }
  }

  private toDomain(row: Record<string, unknown>): Profile {
    return Profile.create({
      userId: UserId.create(row.id as string),
      displayName: row.display_name as string | undefined,
      avatarUrl: row.avatar_url as string | undefined,
      bio: undefined, // user_profiles doesn't have bio field
      countryCode: undefined, // user_profiles doesn't have country_code field
      rankTier: 'bronze', // Default value, user_profiles doesn't have rank_tier
      rankPoints: 0, // Default value, user_profiles doesn't have rank_points
      lastOnlineAt: new Date(row.last_seen_at as string),
      reputationScore: 0, // Default value, user_profiles doesn't have reputation_score
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    });
  }

  private toRow(profile: Profile): Record<string, unknown> {
    return {
      id: profile.getUserId().getValue(),
      display_name: profile.getDisplayName(),
      avatar_url: profile.getAvatarUrl(),
      // user_profiles doesn't have these fields, so we omit them
      updated_at: new Date().toISOString(),
    };
  }
}
