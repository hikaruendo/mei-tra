import { Room } from '../../types/room.types';
import { TransportPlayer } from '../../types/player-adapters';

export interface LeaveRoomRequest {
  playerId: string;
  roomId: string;
}

export interface LeaveRoomSuccessData {
  playerId: string;
  roomDeleted: boolean;
  roomsList: Room[];
  updatedPlayers?: TransportPlayer[];
  gamePausedMessage?: string;
}

export interface LeaveRoomResponse {
  success: boolean;
  errorMessage?: string;
  data?: LeaveRoomSuccessData;
}

export interface ILeaveRoomUseCase {
  execute(request: LeaveRoomRequest): Promise<LeaveRoomResponse>;
}
