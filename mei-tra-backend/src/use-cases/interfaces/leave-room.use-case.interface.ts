import { Room } from '../../types/room.types';
import { Player } from '../../types/game.types';

export interface LeaveRoomRequest {
  clientId: string;
  roomId: string;
}

export interface LeaveRoomSuccessData {
  playerId: string;
  roomDeleted: boolean;
  roomsList: Room[];
  updatedPlayers?: Player[];
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
