import type { DevChomboScenarioType } from '@contracts/game';
import type { GatewayEvent } from './gateway-event.interface';

export interface DevChomboScenarioRequest {
  roomId: string;
  actorId: string;
  violationType: DevChomboScenarioType;
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
