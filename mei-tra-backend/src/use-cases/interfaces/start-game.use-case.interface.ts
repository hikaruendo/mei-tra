import type { UpdatePhasePayload } from '@contracts/game';
import { DomainPlayer } from '../../types/game.types';
import type { SeatId } from '../../types/identity.types';

export interface StartGameRequest {
  actorSeatId: SeatId;
  roomId: string;
}

export interface StartGameSuccessData {
  players: DomainPlayer[];
  pointsToWin: number;
  updatePhase: UpdatePhasePayload;
  currentTurnSeatId: SeatId;
  /**
   * Whether the game-start janken reveal should reserve time: false when
   * every seated human has the animation turned off, so `update-turn` and
   * the first COM move need not wait for a show nobody watches.
   */
  firstTurnRevealEnabled: boolean;
}

export interface StartGameResponse {
  success: boolean;
  errorMessage?: string;
  data?: StartGameSuccessData;
}

export interface IStartGameUseCase {
  execute(request: StartGameRequest): Promise<StartGameResponse>;
}
