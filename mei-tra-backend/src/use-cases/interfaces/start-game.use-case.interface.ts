import type { UpdatePhasePayload } from '@contracts/game';
import { DomainPlayer } from '../../types/game.types';

export interface StartGameRequest {
  playerId: string;
  roomId: string;
}

export interface StartGameSuccessData {
  players: DomainPlayer[];
  pointsToWin: number;
  updatePhase: UpdatePhasePayload;
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
