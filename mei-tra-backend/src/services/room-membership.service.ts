import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { SeatId } from '../types/identity.types';
import { SupabaseService } from '../database/supabase.service';
import {
  ActiveRoomMembership,
  RoomMembershipReplayEvent,
  RoomMembershipReplayEventType,
  RoomMembershipTransition,
  RoomMembershipTransitionResult,
} from '../types/room-membership.types';
import { asSeatId } from '../types/identity.types';

type MembershipRow = {
  user_id: string;
  room_id: string | null;
  seat_id: string;
  status: 'moving' | 'active' | 'disconnected';
  membership_version: number;
  transition_id: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};

type MembershipEventRow = {
  id: number;
  user_id: string;
  from_room_id: string | null;
  to_room_id: string | null;
  seat_id: string | null;
  event_type: string;
  created_at: string;
};

const JOINED_MEMBERSHIP_EVENT_TYPES = [
  'room_claimed',
  'room_created_and_claimed',
  'room_reconnected',
] as const;

const LEFT_MEMBERSHIP_EVENT_TYPES = [
  'room_released',
  'player_membership_released',
  'disconnect_timeout_completed',
] as const;

const REPLAY_MEMBERSHIP_EVENT_TYPES = [
  ...JOINED_MEMBERSHIP_EVENT_TYPES,
  ...LEFT_MEMBERSHIP_EVENT_TYPES,
] as const;

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

  async list(): Promise<ActiveRoomMembership[]> {
    const { data, error } = await this.supabaseService.client
      .from('active_room_memberships')
      .select('*');

    if (error) {
      throw new Error(
        `Failed to list active room memberships: ${error.message}`,
      );
    }

    return (data ?? []).map((row) => this.mapMembership(row));
  }

  async listReplayEventsForRoom(
    roomId: string,
  ): Promise<RoomMembershipReplayEvent[]> {
    const { data, error } = await this.supabaseService.client
      .from('room_membership_events')
      .select(
        'id,user_id,from_room_id,to_room_id,seat_id,event_type,created_at',
      )
      .in('event_type', [...REPLAY_MEMBERSHIP_EVENT_TYPES])
      .or(`from_room_id.eq.${roomId},to_room_id.eq.${roomId}`)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(
        `Failed to list room membership replay events: ${error.message}`,
      );
    }

    return (data ?? [])
      .map((row) => this.mapReplayEvent(row, roomId))
      .filter((event): event is RoomMembershipReplayEvent => event !== null);
  }

  async reserve(
    userId: string,
    seatId: SeatId,
  ): Promise<RoomMembershipTransition> {
    const transitionId = randomUUID();
    const { data, error } = await this.supabaseService.client.rpc(
      'reserve_room_membership',
      {
        p_user_id: userId,
        p_seat_id: seatId,
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
    seatId: SeatId,
  ): Promise<RoomMembershipTransition> {
    const currentMembership = await this.get(userId);
    const transitionId =
      currentMembership?.status === 'moving' &&
      currentMembership.roomId === null &&
      currentMembership.seatId === seatId
        ? currentMembership.transitionId
        : randomUUID();
    const { data, error } = await this.supabaseService.client.rpc(
      'claim_room_membership',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_seat_id: seatId,
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

  async releaseBySeat(roomId: string, seatId: SeatId): Promise<boolean> {
    const { data, error } = await this.supabaseService.client.rpc(
      'release_room_membership_by_seat',
      {
        p_room_id: roomId,
        p_seat_id: seatId,
        p_transition_id: randomUUID(),
      },
    );

    if (error) {
      throw new Error(`Failed to release seat membership: ${error.message}`);
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

  async markDisconnected(
    userId: string,
    roomId: string,
  ): Promise<ActiveRoomMembership | null> {
    const currentMembership = await this.get(userId);
    if (
      !currentMembership ||
      currentMembership.roomId !== roomId ||
      currentMembership.status !== 'active'
    ) {
      return null;
    }

    const { data, error } = await this.supabaseService.client.rpc(
      'mark_room_membership_disconnected',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_expected_version: currentMembership.membershipVersion,
        p_transition_id: randomUUID(),
      },
    );

    if (error) {
      throw new Error(
        `Failed to mark room membership disconnected: ${error.message}`,
      );
    }

    return this.readMutationMembership(data, 'disconnected');
  }

  async startDisconnectTimeout(
    userId: string,
    roomId: string,
    expectedVersion: number,
  ): Promise<ActiveRoomMembership | null> {
    const { data, error } = await this.supabaseService.client.rpc(
      'start_room_membership_timeout',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_expected_version: expectedVersion,
        p_transition_id: randomUUID(),
      },
    );

    if (error) {
      throw new Error(
        `Failed to start room membership timeout: ${error.message}`,
      );
    }

    return this.readMutationMembership(data, 'started');
  }

  async finishDisconnectTimeout(
    membership: ActiveRoomMembership,
    succeeded: boolean,
  ): Promise<'completed' | 'rolled_back' | 'stale'> {
    if (!membership.roomId) {
      return 'stale';
    }

    const { data, error } = await this.supabaseService.client.rpc(
      'finish_room_membership_timeout',
      {
        p_user_id: membership.userId,
        p_room_id: membership.roomId,
        p_expected_version: membership.membershipVersion,
        p_transition_id: membership.transitionId,
        p_succeeded: succeeded,
      },
    );

    if (error) {
      throw new Error(
        `Failed to finish room membership timeout: ${error.message}`,
      );
    }

    const result = this.readString(data, 'result');
    if (!['completed', 'rolled_back', 'stale'].includes(result)) {
      throw new Error(`Unexpected room membership timeout result: ${result}`);
    }
    return result as 'completed' | 'rolled_back' | 'stale';
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
      seatId: asSeatId(row.seat_id),
      status: row.status,
      membershipVersion: row.membership_version,
      transitionId: row.transition_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastSeenAt: new Date(row.last_seen_at),
    };
  }

  private mapReplayEvent(
    row: MembershipEventRow | Record<string, unknown>,
    roomId: string,
  ): RoomMembershipReplayEvent | null {
    if (!this.isMembershipEventRow(row)) {
      throw new Error('Room membership event response has an invalid shape');
    }

    const eventType = this.toReplayEventType(row, roomId);
    if (!eventType) {
      return null;
    }

    return {
      id: `membership-${row.id}`,
      eventType,
      userId: row.user_id,
      roomId,
      seatId: row.seat_id ? asSeatId(row.seat_id) : null,
      timestamp: new Date(row.created_at),
    };
  }

  private toReplayEventType(
    row: MembershipEventRow,
    roomId: string,
  ): RoomMembershipReplayEventType | null {
    if (
      row.to_room_id === roomId &&
      JOINED_MEMBERSHIP_EVENT_TYPES.includes(
        row.event_type as (typeof JOINED_MEMBERSHIP_EVENT_TYPES)[number],
      )
    ) {
      return 'player_joined';
    }

    if (
      row.from_room_id === roomId &&
      LEFT_MEMBERSHIP_EVENT_TYPES.includes(
        row.event_type as (typeof LEFT_MEMBERSHIP_EVENT_TYPES)[number],
      )
    ) {
      return 'player_left';
    }

    return null;
  }

  private readString(data: Record<string, unknown>, key: string): string {
    const value = data[key];
    if (typeof value !== 'string') {
      throw new Error(`Room membership response omitted ${key}`);
    }
    return value;
  }

  private readMutationMembership(
    data: Record<string, unknown>,
    expectedResult: 'disconnected' | 'started',
  ): ActiveRoomMembership | null {
    const result = this.readString(data, 'result');
    if (result === 'stale') {
      return null;
    }
    if (result !== expectedResult || !this.isRecord(data.membership)) {
      throw new Error(`Unexpected room membership mutation result: ${result}`);
    }
    return this.mapMembership(data.membership);
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
      typeof value.seat_id === 'string' &&
      ['moving', 'active', 'disconnected'].includes(String(value.status)) &&
      typeof value.membership_version === 'number' &&
      typeof value.transition_id === 'string' &&
      typeof value.created_at === 'string' &&
      typeof value.updated_at === 'string' &&
      typeof value.last_seen_at === 'string'
    );
  }

  private isMembershipEventRow(
    value: MembershipEventRow | Record<string, unknown>,
  ): value is MembershipEventRow {
    return (
      typeof value.id === 'number' &&
      typeof value.user_id === 'string' &&
      (typeof value.from_room_id === 'string' || value.from_room_id === null) &&
      (typeof value.to_room_id === 'string' || value.to_room_id === null) &&
      (typeof value.seat_id === 'string' || value.seat_id === null) &&
      typeof value.event_type === 'string' &&
      typeof value.created_at === 'string'
    );
  }
}
