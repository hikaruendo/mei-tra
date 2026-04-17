import { Logger } from '@nestjs/common';
import { DomainPlayer } from '../types/game.types';
import { PlayerConnectionState, SessionUser } from '../types/session.types';

export class PlayerConnectionManager {
  readonly users: SessionUser[] = [];
  readonly playerIds: Map<string, string> = new Map();
  readonly disconnectedPlayers: Map<string, NodeJS.Timeout> = new Map();

  constructor(private readonly logger: Logger) {}

  getSessionUsers(): SessionUser[] {
    return this.users;
  }

  addPlayer(
    socketId: string,
    name: string,
    userId?: string,
    isAuthenticated?: boolean,
  ): boolean {
    const playerId = userId || this.generateReconnectToken();
    this.users.push({
      socketId,
      playerId,
      name,
      userId,
      isAuthenticated: isAuthenticated || false,
    });

    if (userId) {
      this.playerIds.set(userId, playerId);
    }

    return true;
  }

  findSessionUserBySocketId(socketId: string): SessionUser | null {
    return this.users.find((user) => user.socketId === socketId) || null;
  }

  findSessionUserByUserId(userId: string): SessionUser | null {
    return this.users.find((user) => user.userId === userId) || null;
  }

  findSessionUserByPlayerId(playerId: string): SessionUser | null {
    return this.users.find((user) => user.playerId === playerId) || null;
  }

  upsertSessionUser(sessionUser: SessionUser): {
    user: SessionUser;
    created: boolean;
    changed: boolean;
  } {
    const existingUser =
      (sessionUser.userId
        ? this.findSessionUserByUserId(sessionUser.userId)
        : null) ?? this.findSessionUserBySocketId(sessionUser.socketId);

    if (!existingUser) {
      this.users.push(sessionUser);
      if (sessionUser.userId) {
        this.playerIds.set(sessionUser.userId, sessionUser.playerId);
      }
      return {
        user: sessionUser,
        created: true,
        changed: true,
      };
    }

    const changed =
      existingUser.socketId !== sessionUser.socketId ||
      existingUser.name !== sessionUser.name ||
      existingUser.userId !== sessionUser.userId ||
      existingUser.isAuthenticated !== sessionUser.isAuthenticated;

    if (changed) {
      existingUser.socketId = sessionUser.socketId;
      existingUser.name = sessionUser.name;
      existingUser.userId = sessionUser.userId;
      existingUser.isAuthenticated = sessionUser.isAuthenticated;
    }

    if (sessionUser.userId) {
      this.playerIds.set(sessionUser.userId, sessionUser.playerId);
    }

    return {
      user: existingUser,
      created: false,
      changed,
    };
  }

  updateUserNameBySocketId(socketId: string, name: string): boolean {
    const user = this.findSessionUserBySocketId(socketId);
    if (!user) {
      return false;
    }

    user.name = name;
    return true;
  }

  removePlayer(players: DomainPlayer[], playerId: string): void {
    const playerIndex = players.findIndex(
      (candidate) => candidate.playerId === playerId,
    );
    if (playerIndex === -1) {
      return;
    }

    this.disconnectedPlayers.set(
      playerId,
      setTimeout(() => {
        this.disconnectedPlayers.delete(playerId);
        const index = players.findIndex(
          (candidate) => candidate.playerId === playerId,
        );
        if (index !== -1) {
          players.splice(index, 1);
        }
      }, 15000),
    );
  }

  registerPlayerToken(token: string, playerId: string): void {
    this.playerIds.set(token, playerId);
  }

  removePlayerToken(playerId: string): void {
    for (const [token, id] of this.playerIds.entries()) {
      if (id === playerId) {
        this.playerIds.delete(token);
        break;
      }
    }
  }

  findPlayerByUserId(
    players: DomainPlayer[],
    userId: string,
  ): DomainPlayer | null {
    const sessionUser = this.findSessionUserByUserId(userId);
    if (!sessionUser) {
      return null;
    }

    return (
      players.find((player) => player.playerId === sessionUser.playerId) || null
    );
  }

  findPlayerByReconnectToken(
    players: DomainPlayer[],
    token: string,
  ): DomainPlayer | null {
    const playerId = this.playerIds.get(token);
    if (playerId) {
      return players.find((player) => player.playerId === playerId) || null;
    }

    return players.find((player) => player.playerId === token) || null;
  }

  getPlayerConnectionState(playerId: string): PlayerConnectionState | null {
    const sessionUser = this.findSessionUserByPlayerId(playerId);
    if (!sessionUser) {
      return null;
    }

    return {
      socketId: sessionUser.socketId,
      userId: sessionUser.userId,
      isAuthenticated: sessionUser.isAuthenticated,
    };
  }

  updatePlayerSocketId(
    playerId: string,
    socketId: string,
    name: string,
    userId?: string,
    isAuthenticated?: boolean,
  ): SessionUser {
    const timeout = this.disconnectedPlayers.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectedPlayers.delete(playerId);
    }

    const { user } = this.upsertSessionUser({
      socketId,
      playerId,
      name,
      userId,
      isAuthenticated: isAuthenticated ?? Boolean(userId),
    });

    if (userId) {
      this.logger.log(
        `[GameState] Updated player ${playerId} with userId: ${userId}`,
      );
    }

    return user;
  }

  applyConnectionState(
    playerId: string,
    name: string,
    connectionState: PlayerConnectionState,
  ): SessionUser {
    return this.updatePlayerSocketId(
      playerId,
      connectionState.socketId,
      name,
      connectionState.userId,
      connectionState.isAuthenticated,
    );
  }

  setDisconnectTimeout(playerId: string, timeout: NodeJS.Timeout): void {
    const existingTimeout = this.disconnectedPlayers.get(playerId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    this.disconnectedPlayers.set(playerId, timeout);
  }

  clearDisconnectTimeout(playerId: string): void {
    const existingTimeout = this.disconnectedPlayers.get(playerId);
    if (!existingTimeout) {
      return;
    }

    clearTimeout(existingTimeout);
    this.disconnectedPlayers.delete(playerId);
  }

  clearAllDisconnectTimeouts(): void {
    for (const timeout of this.disconnectedPlayers.values()) {
      clearTimeout(timeout);
    }
    this.disconnectedPlayers.clear();
  }

  private generateReconnectToken(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
