import { GatewayEvent } from './gateway-event.interface';

export interface ComAutoPlayRequest {
  roomId: string;
}

export interface ComAutoPlayResponse {
  success: boolean;
  events: GatewayEvent[];
  shouldContinue: boolean;
  error?: string;
}

export interface IComAutoPlayUseCase {
  execute(request: ComAutoPlayRequest): Promise<ComAutoPlayResponse>;
}
