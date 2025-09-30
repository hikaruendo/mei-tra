import { GatewayEvent } from './gateway-event.interface';

export interface RevealBrokenHandRequest {
  roomId: string;
  socketId: string;
  playerId: string;
}

export interface RevealBrokenHandPreparation {
  success: boolean;
  error?: string;
  followUp?: {
    roomId: string;
    playerId: string;
  };
  delayMs?: number;
}

export interface RevealBrokenHandCompletion {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
}

export interface IRevealBrokenHandUseCase {
  prepare(
    request: RevealBrokenHandRequest,
  ): Promise<RevealBrokenHandPreparation>;
  finalize(followUp: {
    roomId: string;
    playerId: string;
  }): Promise<RevealBrokenHandCompletion>;
}
