import { Room } from '../../types/room.types';
import { TransportPlayer } from '../../adapters/player-adapters';
import { BlowState } from '../../types/game.types';
import type { SeatId } from '../../types/identity.types';

export interface LeaveRoomRequest {
  seatId: SeatId;
  roomId: string;
}

export interface LeaveRoomSuccessData {
  seatId: SeatId;
  roomDeleted: boolean;
  roomsList: Room[];
  updatedPlayers?: TransportPlayer[];
  blowState?: BlowState;
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
