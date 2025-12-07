import { GatewayEvent } from './gateway-event.interface';
import { CompleteFieldTrigger } from './play-card.use-case.interface';

export interface ComAutoPlayRequest {
  roomId: string;
}

export interface ComAutoPlayResponse {
  success: boolean;
  events: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  revealBrokenRequest?: {
    roomId: string;
    playerId: string;
    socketId: string;
  };
  completeFieldTrigger?: CompleteFieldTrigger;
  shouldContinue: boolean;
  error?: string;
}

export interface IComAutoPlayUseCase {
  execute(request: ComAutoPlayRequest): Promise<ComAutoPlayResponse>;
}
