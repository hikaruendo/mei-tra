import { GatewayEvent } from './gateway-event.interface';
import type { SeatId } from '../../types/identity.types';

export interface RevealBrokenHandRequest {
  roomId: string;
  actorId: string;
  seatId: SeatId;
}

export interface RevealBrokenHandPreparation {
  success: boolean;
  error?: string;
  followUp?: {
    roomId: string;
    seatId: SeatId;
    handSnapshot?: string[];
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
    seatId: SeatId;
    handSnapshot?: string[];
  }): Promise<RevealBrokenHandCompletion>;
}
