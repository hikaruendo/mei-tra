import { Player, Team, TeamScores } from '../../types/game.types';

export interface ProcessGameOverRequest {
  roomId: string;
  players: Player[];
  winningTeam: Team;
  teamScores: TeamScores;
  resetDelayMs: number;
}

export interface IProcessGameOverUseCase {
  execute(request: ProcessGameOverRequest): Promise<void>;
}
