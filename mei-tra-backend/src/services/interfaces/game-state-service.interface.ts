import { Player, User } from '../../types/game.types';

export interface IGameStateService {
  addPlayer(
    socketId: string,
    name: string,
    reconnectToken?: string,
    userId?: string,
    isAuthenticated?: boolean,
  ): boolean;
  getUsers(): User[];
  updateUserName(socketId: string, name: string): boolean;
  findPlayerByUserId(userId: string): Player | null;
  findPlayerByReconnectToken(token: string): Player | null;
  updatePlayerSocketId(
    playerId: string,
    newId: string,
    userId?: string,
  ): Promise<void>;
}
