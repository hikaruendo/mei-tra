import { GatewayEvent } from './gateway-event.interface';

export interface PassBlowRequest {
  roomId: string;
  userId: string;
}

export interface PassBlowResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  revealBrokenRequest?: {
    roomId: string;
    playerId: string;
    userId: string;
  };
}

export interface IPassBlowUseCase {
  execute(request: PassBlowRequest): Promise<PassBlowResponse>;
}
