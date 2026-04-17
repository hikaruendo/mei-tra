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

export interface RevealBrokenRequest {
  roomId: string;
  playerId: string;
  actorId: string;
}

export interface DeclareBlowResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  revealBrokenRequest?: RevealBrokenRequest;
}

export interface IDeclareBlowUseCase {
  execute(request: DeclareBlowRequest): Promise<DeclareBlowResponse>;
}
