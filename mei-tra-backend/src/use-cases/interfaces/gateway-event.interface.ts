export type GatewayEmitScope = 'room' | 'socket' | 'all';

export interface GatewayEvent {
  scope: GatewayEmitScope;
  event: string;
  roomId?: string;
  socketId?: string;
  excludeSocketId?: string;
  payload?: unknown;
  delayMs?: number;
}
