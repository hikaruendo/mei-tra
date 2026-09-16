import type { DeclareOpenPayload } from '@contracts/game';
import type { GameOverInstruction } from './complete-field.use-case.interface';
import type { GatewayEvent } from './gateway-event.interface';

export interface DeclareOpenRequest extends DeclareOpenPayload {
  actorId: string;
}

export interface DeclareOpenResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  gameOver?: GameOverInstruction;
  roundStoppedEarly?: boolean;
}

export interface IDeclareOpenUseCase {
  execute(request: DeclareOpenRequest): Promise<DeclareOpenResponse>;
}
