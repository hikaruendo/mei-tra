import { GatewayEvent } from './gateway-event.interface';
import { TrumpType } from '../../types/game.types';

export interface DeclareBlowRequest {
  roomId: string;
  actorId: string;
  declaration: {
    trumpType: TrumpType;
    numberOfPairs: number;
  };
}

export interface DeclareBlowResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
}

export interface IDeclareBlowUseCase {
  execute(request: DeclareBlowRequest): Promise<DeclareBlowResponse>;
}
