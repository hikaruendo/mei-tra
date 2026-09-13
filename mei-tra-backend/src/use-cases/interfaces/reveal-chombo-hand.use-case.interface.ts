import type { RevealChomboHandPayload } from '@contracts/game';
import type { GatewayEvent } from './gateway-event.interface';

export interface RevealChomboHandRequest extends RevealChomboHandPayload {
  actorId: string;
}
export interface RevealChomboHandResponse { success: boolean; error?: string; events?: GatewayEvent[] }
export interface IRevealChomboHandUseCase { execute(request: RevealChomboHandRequest): Promise<RevealChomboHandResponse> }
