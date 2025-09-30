import { Player, TeamScores, GamePhase } from '../../types/game.types';

export interface StartGameRequest {
  clientId: string;
  roomId: string;
}

export interface StartGameSuccessData {
  players: Player[];
  pointsToWin: number;
  updatePhase: {
    phase: GamePhase;
    scores: TeamScores;
    winner: string | null;
  };
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
