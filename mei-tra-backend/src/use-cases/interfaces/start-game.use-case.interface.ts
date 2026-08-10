import type { UpdatePhasePayload } from '@contracts/game';
import { DomainPlayer } from '../../types/game.types';
import type { SeatId } from '../../types/identity.types';

export interface StartGameRequest {
  playerId: string;
  roomId: string;
}

export interface StartGameSuccessData {
  players: DomainPlayer[];
  pointsToWin: number;
  updatePhase: UpdatePhasePayload;
  currentTurnSeatId: SeatId;
  /** @deprecated Use currentTurnSeatId. */
  currentTurnPlayerId: string;
}

export interface StartGameResponse {
  success: boolean;
  errorMessage?: string;
  data?: StartGameSuccessData;
}

export interface IStartGameUseCase {
  execute(request: StartGameRequest): Promise<StartGameResponse>;
}
