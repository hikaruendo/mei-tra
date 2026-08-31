import type { SeatId } from '../../types/identity.types';
import type {
  ActiveRoomMembership,
  RoomMembershipReplayEvent,
  RoomMembershipTransition,
} from '../../types/room-membership.types';

export interface IRoomMembershipRepository {
  findByUserId(userId: string): Promise<ActiveRoomMembership | null>;
  findAll(): Promise<ActiveRoomMembership[]>;
  findReplayEventsByRoomId(
    roomId: string,
  ): Promise<RoomMembershipReplayEvent[]>;
  reserve(
    userId: string,
    seatId: SeatId,
    transitionId: string,
  ): Promise<RoomMembershipTransition>;
  claim(
    userId: string,
    roomId: string,
    seatId: SeatId,
    transitionId: string,
  ): Promise<RoomMembershipTransition>;
  cancelReservation(userId: string, transitionId: string): Promise<boolean>;
  release(
    userId: string,
    roomId: string,
    expectedVersion: number,
    transitionId: string,
  ): Promise<'released' | 'stale'>;
  releaseBySeat(
    roomId: string,
    seatId: SeatId,
    transitionId: string,
  ): Promise<boolean>;
  releaseRoom(roomId: string, transitionId: string): Promise<number>;
  markDisconnected(
    userId: string,
    roomId: string,
    expectedVersion: number,
    transitionId: string,
  ): Promise<ActiveRoomMembership | null>;
  startDisconnectTimeout(
    userId: string,
    roomId: string,
    expectedVersion: number,
    transitionId: string,
  ): Promise<ActiveRoomMembership | null>;
  finishDisconnectTimeout(
    membership: ActiveRoomMembership,
    succeeded: boolean,
  ): Promise<'completed' | 'rolled_back' | 'stale'>;
}
