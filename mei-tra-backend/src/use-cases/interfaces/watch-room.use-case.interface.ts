import type { GameStatePayload } from '@contracts/game';
import { Room } from '../../types/room.types';

export interface WatchRoomRequest {
  roomId: string;
}

export interface WatchRoomSuccess {
  room: Room;
  gameState: GameStatePayload;
}

export interface WatchRoomResponse {
  success: boolean;
  error?: string;
  data?: WatchRoomSuccess;
}

export interface IWatchRoomUseCase {
  execute(request: WatchRoomRequest): Promise<WatchRoomResponse>;
  buildSnapshot(roomId: string): Promise<GameStatePayload | null>;
}
