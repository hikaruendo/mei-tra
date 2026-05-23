import { GatewayEvent } from './gateway-event.interface';

export interface PassBlowRequest {
  roomId: string;
  actorId: string;
}

export interface PassBlowResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
}

export interface IPassBlowUseCase {
  execute(request: PassBlowRequest): Promise<PassBlowResponse>;
}
