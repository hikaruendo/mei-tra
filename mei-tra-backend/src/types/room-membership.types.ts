import type { SeatId } from './identity.types';

export type ActiveRoomMembershipStatus = 'moving' | 'active' | 'disconnected';

export type RoomMembershipReplayEventType = 'player_joined' | 'player_left';

export interface ActiveRoomMembership {
  userId: string;
  roomId: string | null;
  seatId: SeatId;
  status: ActiveRoomMembershipStatus;
  membershipVersion: number;
  transitionId: string;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
}

export interface RoomMembershipReplayEvent {
  id: string;
  eventType: RoomMembershipReplayEventType;
  userId: string;
  roomId: string;
  seatId: SeatId | null;
  timestamp: Date;
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
