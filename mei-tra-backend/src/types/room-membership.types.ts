export type ActiveRoomMembershipStatus = 'moving' | 'active' | 'disconnected';

export interface ActiveRoomMembership {
  userId: string;
  roomId: string | null;
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

export class ActiveRoomMembershipConflictError extends Error {
  constructor(readonly membership: ActiveRoomMembership) {
    super('User is already active in another room');
    this.name = 'ActiveRoomMembershipConflictError';
  }
}
