import { Room, RoomPlayer, RoomStatus } from '../../types/room.types';
import { User } from '../../types/game.types';
import { GameStateService } from '../game-state.service';

export interface IRoomService {
  createRoom(room: Room): Promise<Room>;
  getRoom(roomId: string): Promise<Room | null>;
  updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | null>;
  deleteRoom(roomId: string): Promise<void>;
  listRooms(): Promise<Room[]>;
  createNewRoom(
    name: string,
    hostId: string,
    pointsToWin: number,
    teamAssignmentMethod: 'random' | 'host-choice',
  ): Promise<Room>;
  leaveRoom(roomId: string, playerId: string): Promise<boolean>;
  joinRoom(roomId: string, user: User): Promise<boolean>;
  updateRoomStatus(roomId: string, status: RoomStatus): Promise<boolean>;
  updatePlayerInRoom(
    roomId: string,
    playerId: string,
    updates: Partial<RoomPlayer>,
  ): Promise<boolean>;
  canStartGame(roomId: string): Promise<{ canStart: boolean; reason?: string }>;
  getRoomGameState(roomId: string): Promise<GameStateService>;
  convertPlayerToDummy(roomId: string, playerId: string): Promise<boolean>;
  restorePlayerFromVacantSeat(
    roomId: string,
    playerId: string,
  ): Promise<boolean>;
  handlePlayerReconnection(
    roomId: string,
    playerId: string,
    socketId: string,
  ): Promise<{ success: boolean; error?: string }>;
  updateUserGameStats(
    userId: string,
    won: boolean,
    score: number,
  ): Promise<void>;
  updateUserLastSeen(userId: string): Promise<void>;
}
