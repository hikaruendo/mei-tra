import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { IRoomMembershipRepository } from '../repositories/interfaces/room-membership.repository.interface';
import type { SeatId } from '../types/identity.types';
import type {
  ActiveRoomMembership,
  RoomMembershipReplayEvent,
  RoomMembershipTransition,
} from '../types/room-membership.types';

@Injectable()
export class RoomMembershipService {
  constructor(
    @Inject('IRoomMembershipRepository')
    private readonly repository: IRoomMembershipRepository,
  ) {}

  get(userId: string): Promise<ActiveRoomMembership | null> {
    return this.repository.findByUserId(userId);
  }

  list(): Promise<ActiveRoomMembership[]> {
    return this.repository.findAll();
  }

  listReplayEventsForRoom(
    roomId: string,
  ): Promise<RoomMembershipReplayEvent[]> {
    return this.repository.findReplayEventsByRoomId(roomId);
  }

  reserve(userId: string, seatId: SeatId): Promise<RoomMembershipTransition> {
    return this.repository.reserve(userId, seatId, randomUUID());
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

    return this.repository.claim(userId, roomId, seatId, transitionId);
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

    return this.repository.cancelReservation(userId, reservationTransitionId);
  }

  release(
    userId: string,
    roomId: string,
    expectedVersion: number,
  ): Promise<'released' | 'stale'> {
    return this.repository.release(
      userId,
      roomId,
      expectedVersion,
      randomUUID(),
    );
  }

  releaseBySeat(roomId: string, seatId: SeatId): Promise<boolean> {
    return this.repository.releaseBySeat(roomId, seatId, randomUUID());
  }

  releaseRoom(roomId: string): Promise<number> {
    return this.repository.releaseRoom(roomId, randomUUID());
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

    return this.repository.markDisconnected(
      userId,
      roomId,
      currentMembership.membershipVersion,
      randomUUID(),
    );
  }

  startDisconnectTimeout(
    userId: string,
    roomId: string,
    expectedVersion: number,
  ): Promise<ActiveRoomMembership | null> {
    return this.repository.startDisconnectTimeout(
      userId,
      roomId,
      expectedVersion,
      randomUUID(),
    );
  }

  finishDisconnectTimeout(
    membership: ActiveRoomMembership,
    succeeded: boolean,
  ): Promise<'completed' | 'rolled_back' | 'stale'> {
    if (!membership.roomId) {
      return Promise.resolve('stale');
    }

    return this.repository.finishDisconnectTimeout(membership, succeeded);
  }
}
