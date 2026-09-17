import { GatewayEvent } from './gateway-event.interface';
import { Field, FieldIdentity, Team, TeamScores } from '../../types/game.types';

export interface CompleteFieldRequest {
  roomId: string;
  field: Field;
  fieldIdentity?: FieldIdentity;
}

export interface GameOverInstruction {
  winningTeam: Team;
  teamScores: TeamScores;
  resetDelayMs: number;
}

export interface CompleteFieldResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  gameOver?: GameOverInstruction;
  /**
   * Set when a player action ended the round before the work scheduled for it
   * ran: a chombo report or a valid open. That work belongs to a round that no
   * longer exists and is dropped. A round that played itself out does not set
   * this, because the scheduled work is what ended it.
   */
  roundStoppedEarly?: boolean;
}

export interface ICompleteFieldUseCase {
  execute(request: CompleteFieldRequest): Promise<CompleteFieldResponse>;
}
