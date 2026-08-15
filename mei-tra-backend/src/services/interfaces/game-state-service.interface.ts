import { DomainPlayer } from '../../types/game.types';
import { PlayerConnectionState, SessionUser } from '../../types/session.types';
import { RoomPlayer } from '../../types/room.types';
import { RosterMembershipMutation } from '../../types/room-membership.types';
import type { SeatId } from '../../types/identity.types';

export interface IGameStateService {
  addPlayer(
    socketId: string,
    name: string,
    userId?: string,
    isAuthenticated?: boolean,
  ): boolean;
  getSessionUsers(): SessionUser[];
  findSessionUserBySocketId(socketId: string): SessionUser | null;
  findSessionUserByUserId(userId: string): SessionUser | null;
  findSessionUserBySeatId(seatId: SeatId): SessionUser | null;
  upsertSessionUser(sessionUser: SessionUser): {
    user: SessionUser;
    created: boolean;
    changed: boolean;
  };
  updateUserNameBySocketId(socketId: string, name: string): boolean;
  findPlayerByActorId(actorId: string): DomainPlayer | null;
  findPlayerBySocketId(socketId: string): DomainPlayer | null;
  updatePlayerSocketId(
    seatId: SeatId,
    socketId: string,
    userId?: string,
  ): Promise<void>;
  applyPlayerConnectionState(
    seatId: SeatId,
    connectionState: PlayerConnectionState,
  ): Promise<void>;
  getPlayerConnectionState(seatId: SeatId): PlayerConnectionState | null;
  persistRoster(
    roomPlayers: RoomPlayer[],
    hostSeatId?: SeatId,
    membershipMutation?: RosterMembershipMutation,
  ): Promise<void>;
  reconcileWaitingRoomPlayers(roomPlayers: RoomPlayer[]): Promise<void>;
}
