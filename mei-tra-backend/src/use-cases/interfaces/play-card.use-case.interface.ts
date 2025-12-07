import { GatewayEvent } from './gateway-event.interface';
import { Field } from '../../types/game.types';

export interface PlayCardRequest {
  roomId: string;
  socketId: string;
  card: string;
}

export interface CompleteFieldTrigger {
  roomId: string;
  delayMs: number;
  field: Field;
}

export interface PlayCardResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  completeFieldTrigger?: CompleteFieldTrigger;
}

export interface IPlayCardUseCase {
  execute(request: PlayCardRequest): Promise<PlayCardResponse>;
}
