import { Room } from '../../types/room.types';

export interface FillWithComRequest {
  roomId: string;
  playerId: string; // Player ID of the requesting player
}

export interface FillWithComResponse {
  success: boolean;
  error?: string;
  updatedRoom?: Room;
}

export interface IFillWithComUseCase {
  execute(request: FillWithComRequest): Promise<FillWithComResponse>;
}
