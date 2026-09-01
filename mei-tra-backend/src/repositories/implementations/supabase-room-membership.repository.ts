import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import type { Database as GeneratedDatabase } from '../../types/database.generated.types';
import { asSeatId, type SeatId } from '../../types/identity.types';
import type {
  ActiveRoomMembership,
  RoomMembershipReplayEvent,
  RoomMembershipReplayEventType,
  RoomMembershipTransition,
  RoomMembershipTransitionResult,
} from '../../types/room-membership.types';
import type { IRoomMembershipRepository } from '../interfaces/room-membership.repository.interface';

type MembershipRow =
  GeneratedDatabase['public']['Tables']['active_room_memberships']['Row'];
type MembershipEventRow = Pick<
  GeneratedDatabase['public']['Tables']['room_membership_events']['Row'],
  | 'id'
  | 'user_id'
  | 'from_room_id'
  | 'to_room_id'
  | 'seat_id'
  | 'event_type'
  | 'created_at'
>;
type GeneratedFunctions = GeneratedDatabase['public']['Functions'];
type MembershipRpcName =
  | 'reserve_room_membership'
  | 'claim_room_membership'
  | 'cancel_room_membership_reservation'
  | 'release_room_membership'
  | 'release_room_membership_by_seat'
  | 'release_room_memberships_for_room'
  | 'mark_room_membership_disconnected'
  | 'start_room_membership_timeout'
  | 'finish_room_membership_timeout';

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
export class SupabaseRoomMembershipRepository
  implements IRoomMembershipRepository
{
  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async findByUserId(userId: string): Promise<ActiveRoomMembership | null> {
    const { data, error } = await this.supabase
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

  async findAll(): Promise<ActiveRoomMembership[]> {
    const { data, error } = await this.supabase
      .from('active_room_memberships')
      .select('*');

    if (error) {
      throw new Error(
        `Failed to list active room memberships: ${error.message}`,
      );
    }

    return (data ?? []).map((row) => this.mapMembership(row));
  }

  async findReplayEventsByRoomId(
    roomId: string,
  ): Promise<RoomMembershipReplayEvent[]> {
    const { data, error } = await this.supabase
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
    transitionId: string,
  ): Promise<RoomMembershipTransition> {
    const data = await this.rpc(
      'reserve_room_membership',
      {
        p_user_id: userId,
        p_seat_id: seatId,
        p_transition_id: transitionId,
      },
      'Failed to reserve room membership',
    );
    return this.parseTransition(data);
  }

  async claim(
    userId: string,
    roomId: string,
    seatId: SeatId,
    transitionId: string,
  ): Promise<RoomMembershipTransition> {
    const data = await this.rpc(
      'claim_room_membership',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_seat_id: seatId,
        p_transition_id: transitionId,
      },
      'Failed to claim room membership',
    );
    return this.parseTransition(data);
  }

  async cancelReservation(
    userId: string,
    transitionId: string,
  ): Promise<boolean> {
    return this.rpc(
      'cancel_room_membership_reservation',
      {
        p_user_id: userId,
        p_transition_id: transitionId,
      },
      'Failed to cancel room membership reservation',
    );
  }

  async release(
    userId: string,
    roomId: string,
    expectedVersion: number,
    transitionId: string,
  ): Promise<'released' | 'stale'> {
    const data = await this.rpc(
      'release_room_membership',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_expected_version: expectedVersion,
        p_transition_id: transitionId,
      },
      'Failed to release room membership',
    );
    const result = this.readString(data, 'result');
    if (result !== 'released' && result !== 'stale') {
      throw new Error(`Unexpected room membership release result: ${result}`);
    }
    return result;
  }

  async releaseBySeat(
    roomId: string,
    seatId: SeatId,
    transitionId: string,
  ): Promise<boolean> {
    return this.rpc(
      'release_room_membership_by_seat',
      {
        p_room_id: roomId,
        p_seat_id: seatId,
        p_transition_id: transitionId,
      },
      'Failed to release seat membership',
    );
  }

  async releaseRoom(roomId: string, transitionId: string): Promise<number> {
    return this.rpc(
      'release_room_memberships_for_room',
      {
        p_room_id: roomId,
        p_transition_id: transitionId,
      },
      'Failed to release room memberships',
    );
  }

  async markDisconnected(
    userId: string,
    roomId: string,
    expectedVersion: number,
    transitionId: string,
  ): Promise<ActiveRoomMembership | null> {
    const data = await this.rpc(
      'mark_room_membership_disconnected',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_expected_version: expectedVersion,
        p_transition_id: transitionId,
      },
      'Failed to mark room membership disconnected',
    );
    return this.readMutationMembership(data, 'disconnected');
  }

  async startDisconnectTimeout(
    userId: string,
    roomId: string,
    expectedVersion: number,
    transitionId: string,
  ): Promise<ActiveRoomMembership | null> {
    const data = await this.rpc(
      'start_room_membership_timeout',
      {
        p_user_id: userId,
        p_room_id: roomId,
        p_expected_version: expectedVersion,
        p_transition_id: transitionId,
      },
      'Failed to start room membership timeout',
    );
    return this.readMutationMembership(data, 'started');
  }

  async finishDisconnectTimeout(
    membership: ActiveRoomMembership,
    succeeded: boolean,
  ): Promise<'completed' | 'rolled_back' | 'stale'> {
    if (!membership.roomId) {
      return 'stale';
    }

    const data = await this.rpc(
      'finish_room_membership_timeout',
      {
        p_user_id: membership.userId,
        p_room_id: membership.roomId,
        p_expected_version: membership.membershipVersion,
        p_transition_id: membership.transitionId,
        p_succeeded: succeeded,
      },
      'Failed to finish room membership timeout',
    );
    const result = this.readString(data, 'result');
    if (
      result !== 'completed' &&
      result !== 'rolled_back' &&
      result !== 'stale'
    ) {
      throw new Error(`Unexpected room membership timeout result: ${result}`);
    }
    return result;
  }

  private async rpc<Name extends MembershipRpcName>(
    name: Name,
    args: GeneratedFunctions[Name]['Args'],
    errorMessage: string,
  ): Promise<GeneratedFunctions[Name]['Returns']> {
    const { data, error } = await this.supabase.rpc(name, args);
    if (error) {
      throw new Error(`${errorMessage}: ${error.message}`);
    }
    return data;
  }

  private parseTransition(data: unknown): RoomMembershipTransition {
    const result = this.readString(data, 'result');
    if (!this.isTransitionResult(result)) {
      throw new Error(
        `Unexpected room membership transition result: ${result}`,
      );
    }

    if (!this.isRecord(data) || !this.isRecord(data.membership)) {
      throw new Error('Room membership transition omitted membership data');
    }

    return {
      result,
      membership: this.mapMembership(data.membership),
    };
  }

  private mapMembership(row: unknown): ActiveRoomMembership {
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
    row: unknown,
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

  private readString(data: unknown, key: string): string {
    if (!this.isRecord(data) || typeof data[key] !== 'string') {
      throw new Error(`Room membership response omitted ${key}`);
    }
    return data[key];
  }

  private readMutationMembership(
    data: unknown,
    expectedResult: 'disconnected' | 'started',
  ): ActiveRoomMembership | null {
    const result = this.readString(data, 'result');
    if (result === 'stale') {
      return null;
    }
    if (
      result !== expectedResult ||
      !this.isRecord(data) ||
      !this.isRecord(data.membership)
    ) {
      throw new Error(`Unexpected room membership mutation result: ${result}`);
    }
    return this.mapMembership(data.membership);
  }

  private isTransitionResult(
    result: string,
  ): result is RoomMembershipTransitionResult {
    return (
      result === 'reserved' ||
      result === 'claimed' ||
      result === 'reconnected' ||
      result === 'conflict'
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isMembershipRow(value: unknown): value is MembershipRow {
    return (
      this.isRecord(value) &&
      typeof value.user_id === 'string' &&
      (typeof value.room_id === 'string' || value.room_id === null) &&
      typeof value.seat_id === 'string' &&
      (value.status === 'moving' ||
        value.status === 'active' ||
        value.status === 'disconnected') &&
      typeof value.membership_version === 'number' &&
      typeof value.transition_id === 'string' &&
      typeof value.created_at === 'string' &&
      typeof value.updated_at === 'string' &&
      typeof value.last_seen_at === 'string'
    );
  }

  private isMembershipEventRow(value: unknown): value is MembershipEventRow {
    return (
      this.isRecord(value) &&
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
