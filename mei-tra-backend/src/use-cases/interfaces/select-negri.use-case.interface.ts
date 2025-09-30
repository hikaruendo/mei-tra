import { GatewayEvent } from './gateway-event.interface';

export interface SelectNegriRequest {
  roomId: string;
  socketId: string;
  card: string;
}

export interface SelectNegriResponse {
  success: boolean;
  error?: string;
  events?: GatewayEvent[];
}

export interface ISelectNegriUseCase {
  execute(request: SelectNegriRequest): Promise<SelectNegriResponse>;
}
