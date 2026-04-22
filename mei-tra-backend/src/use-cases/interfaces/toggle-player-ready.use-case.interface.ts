import { Room } from '../../types/room.types';
import { TransportPlayer } from '../../types/player-adapters';

export interface TogglePlayerReadyRequest {
  roomId: string;
  playerId: string;
}

export interface TogglePlayerReadyResponse {
  success: boolean;
  error?: string;
  updatedRoom?: Room;
  updatedPlayers?: TransportPlayer[];
}

export interface ITogglePlayerReadyUseCase {
  execute(
    request: TogglePlayerReadyRequest,
  ): Promise<TogglePlayerReadyResponse>;
}
