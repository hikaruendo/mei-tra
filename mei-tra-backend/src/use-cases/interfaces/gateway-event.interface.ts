export type GatewayEmitScope = 'room' | 'socket' | 'all';

export interface GatewayEvent<
  TPayload = unknown,
  TEvent extends string = string,
> {
  scope: GatewayEmitScope;
  event: TEvent;
  roomId?: string;
  socketId?: string;
  excludeSocketId?: string;
  payload?: TPayload;
  delayMs?: number;
}
