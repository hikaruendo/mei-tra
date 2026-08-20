import { Room, RoomPlayer, RoomStatus } from '../../types/room.types';
import { RosterMembershipMutation } from '../../types/room-membership.types';
import { GameStateService } from '../game-state.service';
import { SessionUser } from '../../types/session.types';
import type { SeatId } from '../../types/identity.types';

export interface IRoomService {
  getRoom(roomId: string): Promise<Room | null>;
  updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | null>;
  deleteRoom(roomId: string): Promise<void>;
  releaseRoomResources(roomId: string): Promise<void>;
  listRooms(): Promise<Room[]>;
  createNewRoom(
    name: string,
    hostUser: SessionUser,
    pointsToWin: number,
    teamAssignmentMethod: 'random' | 'host-choice',
  ): Promise<Room>;
  cancelRoomMembershipReservation(userId: string): Promise<boolean>;
  leaveRoom(
    roomId: string,
    seatId: SeatId,
    options?: {
      releaseMembership?: boolean;
      membershipMutation?: RosterMembershipMutation;
    },
  ): Promise<boolean>;
  joinRoom(roomId: string, user: SessionUser): Promise<boolean>;
  updateRoomStatus(roomId: string, status: RoomStatus): Promise<boolean>;
  updatePlayerInRoom(
    roomId: string,
    seatId: SeatId,
    updates: Partial<RoomPlayer>,
  ): Promise<boolean>;
  updatePlayersInRoom(
    roomId: string,
    updatesBySeatId: Partial<Record<SeatId, Partial<RoomPlayer>>>,
  ): Promise<boolean>;
  canStartGame(roomId: string): Promise<{ canStart: boolean; reason?: string }>;
  getRoomGameState(roomId: string): Promise<GameStateService>;
  convertPlayerToCOM(
    roomId: string,
    seatId: SeatId,
    options?: {
      requireDisconnected?: boolean;
      releaseMembership?: boolean;
      membershipMutation?: RosterMembershipMutation;
    },
  ): Promise<boolean>;
  restorePlayerFromVacantSeat(roomId: string, seatId: SeatId): Promise<boolean>;
  handlePlayerReconnection(
    roomId: string,
    seatId: SeatId,
    socketId: string,
    userId?: string,
    name?: string,
  ): Promise<{ success: boolean; error?: string }>;
  updateUserGameStats(
    userId: string,
    won: boolean,
    score: number,
  ): Promise<void>;
  updateUserLastSeen(userId: string): Promise<void>;
  fillVacantSeatsWithCOM(roomId: string): Promise<void>;
  initCOMPlaceholders(roomId: string): Promise<void>;
}
