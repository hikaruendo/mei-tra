import { DomainPlayer } from '../../types/game.types';
import { PlayerConnectionState, SessionUser } from '../../types/session.types';

export interface IGameStateService {
  addPlayer(
    socketId: string,
    name: string,
    userId?: string,
    isAuthenticated?: boolean,
  ): boolean;
  getSessionUsers(): SessionUser[];
  findSessionUserBySocketId(socketId: string): SessionUser | null;
  findSessionUserByUserId(userId: string): SessionUser | null;
  findSessionUserByPlayerId(playerId: string): SessionUser | null;
  upsertSessionUser(sessionUser: SessionUser): {
    user: SessionUser;
    created: boolean;
    changed: boolean;
  };
  updateUserNameBySocketId(socketId: string, name: string): boolean;
  findPlayerByActorId(actorId: string): DomainPlayer | null;
  findPlayerBySocketId(socketId: string): DomainPlayer | null;
  updatePlayerSocketId(
    playerId: string,
    socketId: string,
    userId?: string,
  ): Promise<void>;
  applyPlayerConnectionState(
    playerId: string,
    connectionState: PlayerConnectionState,
  ): Promise<void>;
  getPlayerConnectionState(playerId: string): PlayerConnectionState | null;
}
