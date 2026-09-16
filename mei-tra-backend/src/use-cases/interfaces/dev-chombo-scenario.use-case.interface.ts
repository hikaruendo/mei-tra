import type { ChomboViolation } from '../../types/game.types';
import type { GatewayEvent } from './gateway-event.interface';

export interface DevChomboScenarioRequest {
  roomId: string;
  actorId: string;
  violationType: ChomboViolation['type'];
}

export interface DevChomboScenarioResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
}

export interface IDevChomboScenarioUseCase {
  execute(
    request: DevChomboScenarioRequest,
  ): Promise<DevChomboScenarioResponse>;
}
