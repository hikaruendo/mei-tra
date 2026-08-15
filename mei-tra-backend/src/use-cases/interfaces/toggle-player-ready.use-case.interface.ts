import { Room } from '../../types/room.types';
import { TransportPlayer } from '../../adapters/player-adapters';
import type { SeatId } from '../../types/identity.types';

export interface TogglePlayerReadyRequest {
  roomId: string;
  actorSeatId: SeatId;
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
