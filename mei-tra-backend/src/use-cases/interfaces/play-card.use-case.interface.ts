import { GatewayEvent } from './gateway-event.interface';
import { Field, FieldIdentity } from '../../types/game.types';
import type { PlayCardPayload, UpdateTurnPayload } from '@contracts/game';
import type { CardPlayedPayload } from '@contracts/game';

export interface PlayCardRequest extends PlayCardPayload {
  actorId: string;
}

export type PlayCardGatewayEvent =
  | GatewayEvent<CardPlayedPayload, 'card-played'>
  | GatewayEvent<UpdateTurnPayload, 'update-turn'>;

export interface CompleteFieldTrigger {
  roomId: string;
  delayMs: number;
  field: Field;
  fieldIdentity: FieldIdentity;
  initiatingActorId?: string;
}

export interface PlayCardResponse {
  success: boolean;
  error?: string;
  events?: PlayCardGatewayEvent[];
  delayedEvents?: GatewayEvent[];
  completeFieldTrigger?: CompleteFieldTrigger;
}

export interface IPlayCardUseCase {
  execute(request: PlayCardRequest): Promise<PlayCardResponse>;
}
