import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../database/supabase.service';
import {
  ActiveRoomMembership,
  RoomMembershipTransition,
  RoomMembershipTransitionResult,
} from '../types/room-membership.types';

type MembershipRow = {
  user_id: string;
  room_id: string | null;
  player_id: string;
  status: 'moving' | 'active' | 'disconnected';
  membership_version: number;
  transition_id: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};

@Injectable()
export class RoomMembershipService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async get(userId: string): Promise<ActiveRoomMembership | null> {
    const { data, error } = await this.supabaseService.client
      .from('active_room_memberships')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to load active room membership: ${error.message}`,
      );
    }

    return data ? this.mapMembership(data) : null;
  }

  async reserve(
    userId: string,
    playerId: string,
  ): Promise<RoomMembershipTransition> {
    const transitionId = randomUUID();
    const { data, error } = await this.supabaseService.client.rpc(
      'reserve_room_membership',
      {
        p_user_id: userId,
        p_player_id: playerId,
        p_transition_id: transitionId,
      },
    );

    if (error) {
      throw new Error(`Failed to reserve room membership: ${error.message}`);
    }

    return this.parseTransition(data);
  }

  async claim(
    userId: string,
    roomId: string,
    playerId: string,
  ): Promise<RoomMembershipTransition> {
    const currentMembership = await this.get(userId);
    const transitionId =
      currentMembership?.status === 'moving' &&
      currentMembership.playerId === playerId
        ? currentMembership.transitionId
        : randomUUID();
    const { data, error } = await this.supabaseService.client.rpc(
      'claim_room_membership',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_player_id: playerId,
        p_transition_id: transitionId,
      },
    );

    if (error) {
      throw new Error(`Failed to claim room membership: ${error.message}`);
    }

    return this.parseTransition(data);
  }

  async cancelReservation(
    userId: string,
    transitionId?: string,
  ): Promise<boolean> {
    const membership = transitionId ? null : await this.get(userId);
    const reservationTransitionId =
      transitionId ??
      (membership?.status === 'moving' ? membership.transitionId : null);
    if (!reservationTransitionId) {
      return false;
    }

    const { data, error } = await this.supabaseService.client.rpc(
      'cancel_room_membership_reservation',
      {
        p_user_id: userId,
        p_transition_id: reservationTransitionId,
      },
    );

    if (error) {
      throw new Error(
        `Failed to cancel room membership reservation: ${error.message}`,
      );
    }

    return data;
  }

  async release(
    userId: string,
    roomId: string,
    expectedVersion: number,
  ): Promise<'released' | 'stale'> {
    const { data, error } = await this.supabaseService.client.rpc(
      'release_room_membership',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_expected_version: expectedVersion,
        p_transition_id: randomUUID(),
      },
    );

    if (error) {
      throw new Error(`Failed to release room membership: ${error.message}`);
    }

    const result = this.readString(data, 'result');
    if (result !== 'released' && result !== 'stale') {
      throw new Error(`Unexpected room membership release result: ${result}`);
    }
    return result;
  }

  async releaseByPlayer(roomId: string, playerId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService.client.rpc(
      'release_room_membership_by_player',
      {
        p_room_id: roomId,
        p_player_id: playerId,
        p_transition_id: randomUUID(),
      },
    );

    if (error) {
      throw new Error(`Failed to release player membership: ${error.message}`);
    }

    return data;
  }

  async releaseRoom(roomId: string): Promise<number> {
    const { data, error } = await this.supabaseService.client.rpc(
      'release_room_memberships_for_room',
      {
        p_room_id: roomId,
        p_transition_id: randomUUID(),
      },
    );

    if (error) {
      throw new Error(`Failed to release room memberships: ${error.message}`);
    }

    return data;
  }

  private parseTransition(
    data: Record<string, unknown>,
  ): RoomMembershipTransition {
    const result = this.readString(data, 'result');
    if (!this.isTransitionResult(result)) {
      throw new Error(
        `Unexpected room membership transition result: ${result}`,
      );
    }

    const membership = data.membership;
    if (!this.isRecord(membership)) {
      throw new Error('Room membership transition omitted membership data');
    }

    return {
      result,
      membership: this.mapMembership(membership),
    };
  }

  private mapMembership(
    row: MembershipRow | Record<string, unknown>,
  ): ActiveRoomMembership {
    if (!this.isMembershipRow(row)) {
      throw new Error('Room membership response has an invalid shape');
    }
    return {
      userId: row.user_id,
      roomId: row.room_id,
      playerId: row.player_id,
      status: row.status,
      membershipVersion: row.membership_version,
      transitionId: row.transition_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastSeenAt: new Date(row.last_seen_at),
    };
  }

  private readString(data: Record<string, unknown>, key: string): string {
    const value = data[key];
    if (typeof value !== 'string') {
      throw new Error(`Room membership response omitted ${key}`);
    }
    return value;
  }

  private isTransitionResult(
    result: string,
  ): result is RoomMembershipTransitionResult {
    return ['reserved', 'claimed', 'reconnected', 'conflict'].includes(result);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isMembershipRow(
    value: MembershipRow | Record<string, unknown>,
  ): value is MembershipRow {
    return (
      typeof value.user_id === 'string' &&
      (typeof value.room_id === 'string' || value.room_id === null) &&
      typeof value.player_id === 'string' &&
      ['moving', 'active', 'disconnected'].includes(String(value.status)) &&
      typeof value.membership_version === 'number' &&
      typeof value.transition_id === 'string' &&
      typeof value.created_at === 'string' &&
      typeof value.updated_at === 'string' &&
      typeof value.last_seen_at === 'string'
    );
  }
}
