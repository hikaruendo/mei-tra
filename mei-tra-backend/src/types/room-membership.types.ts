import type { SeatId } from './identity.types';

export type ActiveRoomMembershipStatus = 'moving' | 'active' | 'disconnected';

export interface ActiveRoomMembership {
  userId: string;
  roomId: string | null;
  seatId: SeatId | null;
  /** @deprecated Use seatId while roomId is non-null. */
  playerId: string;
  status: ActiveRoomMembershipStatus;
  membershipVersion: number;
  transitionId: string;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
}

export type RoomMembershipTransitionResult =
  | 'reserved'
  | 'claimed'
  | 'reconnected'
  | 'conflict';

export interface RoomMembershipTransition {
  result: RoomMembershipTransitionResult;
  membership: ActiveRoomMembership;
}

export type RosterMembershipMutation =
  | {
      type: 'claim';
      userId: string;
      transitionId: string;
    }
  | {
      type: 'release';
      seatId: SeatId;
      transitionId: string;
    }
  | {
      type: 'complete-disconnect-timeout';
      userId: string;
      expectedVersion: number;
      transitionId: string;
    };

export class ActiveRoomMembershipConflictError extends Error {
  constructor(readonly membership: ActiveRoomMembership) {
    super('User is already active in another room');
    this.name = 'ActiveRoomMembershipConflictError';
  }
}
