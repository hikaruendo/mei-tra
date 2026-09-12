import type { ReportChomboPayload } from '@contracts/game';
import type { GatewayEvent } from './gateway-event.interface';

export interface ReportChomboRequest extends ReportChomboPayload {
  actorId: string;
}

export interface ReportChomboResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
}

export interface IReportChomboUseCase {
  execute(request: ReportChomboRequest): Promise<ReportChomboResponse>;
}
