export type GatewayEmitScope = 'room' | 'socket' | 'all';

export interface GatewayEvent {
  scope: GatewayEmitScope;
  event: string;
  roomId?: string;
  socketId?: string;
  payload?: unknown;
  delayMs?: number;
}
