import { GatewayEvent } from './gateway-event.interface';
import { CompleteFieldTrigger } from './play-card.use-case.interface';
import type { SeatId } from '../../types/identity.types';

export interface ComAutoPlayRequest {
  roomId: string;
}

/**
 * A COM revealed a broken hand and the redeal owes the table the reveal delay,
 * exactly as it does for a player. The caller owns the timer.
 */
export interface BrokenHandRevealTrigger {
  followUp: {
    roomId: string;
    seatId: SeatId;
    handSnapshot?: string[];
  };
  delayMs: number;
}

export interface ComAutoPlayResponse {
  success: boolean;
  events: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  completeFieldTrigger?: CompleteFieldTrigger;
  brokenHandRevealTrigger?: BrokenHandRevealTrigger;
  shouldContinue: boolean;
  error?: string;
}

export interface IComAutoPlayUseCase {
  execute(request: ComAutoPlayRequest): Promise<ComAutoPlayResponse>;
}
