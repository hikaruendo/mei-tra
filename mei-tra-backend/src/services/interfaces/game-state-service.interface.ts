import { ConnectionUser, Player } from '../../types/game.types';

export interface IGameStateService {
  addPlayer(
    socketId: string,
    name: string,
    userId?: string,
    isAuthenticated?: boolean,
  ): boolean;
  getUsers(): ConnectionUser[];
  findConnectionUserBySocketId(socketId: string): ConnectionUser | null;
  findConnectionUserByUserId(userId: string): ConnectionUser | null;
  updateUserNameBySocketId(socketId: string, name: string): boolean;
  findPlayerByUserId(userId: string): Player | null;
  findPlayerByReconnectToken(token: string): Player | null;
  updatePlayerSocketId(
    playerId: string,
    socketId: string,
    userId?: string,
  ): Promise<void>;
}
