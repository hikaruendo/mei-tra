import type { ReportChomboPayload } from '@contracts/game';
import type { GameOverInstruction } from './complete-field.use-case.interface';
import type { GatewayEvent } from './gateway-event.interface';

export interface ReportChomboRequest extends ReportChomboPayload {
  actorId: string;
}

export interface ReportChomboResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  gameOver?: GameOverInstruction;
  roundStoppedEarly?: boolean;
}

export interface IReportChomboUseCase {
  execute(request: ReportChomboRequest): Promise<ReportChomboResponse>;
}
