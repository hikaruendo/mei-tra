import { GatewayEvent } from './gateway-event.interface';
import { Field, Player, Team, TeamScores } from '../../types/game.types';

export interface CompleteFieldRequest {
  roomId: string;
  field: Field;
}

export interface GameOverInstruction {
  winningTeam: Team;
  teamScores: TeamScores;
  players: Player[];
  resetDelayMs: number;
}

export interface CompleteFieldResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  gameOver?: GameOverInstruction;
}

export interface ICompleteFieldUseCase {
  execute(request: CompleteFieldRequest): Promise<CompleteFieldResponse>;
}
