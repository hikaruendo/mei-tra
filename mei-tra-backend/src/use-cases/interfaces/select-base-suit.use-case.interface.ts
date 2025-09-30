import { GatewayEvent } from './gateway-event.interface';

export interface SelectBaseSuitRequest {
  roomId: string;
  socketId: string;
  suit: string;
}

export interface SelectBaseSuitResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
}

export interface ISelectBaseSuitUseCase {
  execute(request: SelectBaseSuitRequest): Promise<SelectBaseSuitResponse>;
}
