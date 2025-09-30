import { Room } from '../../types/room.types';

export interface TogglePlayerReadyRequest {
  roomId: string;
  playerId: string;
}

export interface TogglePlayerReadyResponse {
  success: boolean;
  error?: string;
  updatedRoom?: Room;
}

export interface ITogglePlayerReadyUseCase {
  execute(
    request: TogglePlayerReadyRequest,
  ): Promise<TogglePlayerReadyResponse>;
}
