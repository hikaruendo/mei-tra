import type { DeclareOpenPayload } from '@contracts/game';
import type { GatewayEvent } from './gateway-event.interface';

export interface DeclareOpenRequest extends DeclareOpenPayload {
  actorId: string;
}

export interface DeclareOpenResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
}

export interface IDeclareOpenUseCase {
  execute(request: DeclareOpenRequest): Promise<DeclareOpenResponse>;
}
