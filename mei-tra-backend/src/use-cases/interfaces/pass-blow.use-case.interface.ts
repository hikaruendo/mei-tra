import { GatewayEvent } from './gateway-event.interface';

export interface PassBlowRequest {
  roomId: string;
  socketId: string;
}

export interface PassBlowResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  revealBrokenRequest?: {
    roomId: string;
    playerId: string;
    socketId: string;
  };
}

export interface IPassBlowUseCase {
  execute(request: PassBlowRequest): Promise<PassBlowResponse>;
}
