import { GatewayEvent } from './gateway-event.interface';
import { AuthenticatedUser } from '../../types/user.types';

export interface UpdateAuthRequest {
  socketId: string;
  token?: string;
  currentRoomId?: string;
  handshakeName?: string;
}

export interface UpdateAuthResponse {
  success: boolean;
  error?: string;
  authenticatedUser?: AuthenticatedUser;
  clientEvents?: GatewayEvent[];
  broadcastEvents?: GatewayEvent[];
  roomEvents?: GatewayEvent[];
}

export interface IUpdateAuthUseCase {
  execute(request: UpdateAuthRequest): Promise<UpdateAuthResponse>;
}
