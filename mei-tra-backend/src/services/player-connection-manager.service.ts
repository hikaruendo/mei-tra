import { Logger } from '@nestjs/common';
import { DomainPlayer } from '../types/game.types';
import { PlayerConnectionState, SessionUser } from '../types/session.types';
import type { SeatId } from '../types/identity.types';

export class PlayerConnectionManager {
  readonly users: SessionUser[] = [];
  readonly seatIdsByToken: Map<string, SeatId> = new Map();
  readonly disconnectTimeoutsBySeatId: Map<SeatId, NodeJS.Timeout> = new Map();

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
    this.users.push({
      socketId,
      name,
      userId,
      isAuthenticated: isAuthenticated || false,
    });

    return true;
  }

  findSessionUserBySocketId(socketId: string): SessionUser | null {
    return this.users.find((user) => user.socketId === socketId) || null;
  }

  findSessionUserByUserId(userId: string): SessionUser | null {
    return this.users.find((user) => user.userId === userId) || null;
  }

  findSessionUserBySeatId(seatId: SeatId): SessionUser | null {
    return this.users.find((user) => user.seatId === seatId) || null;
  }

  upsertSessionUser(sessionUser: SessionUser): {
    user: SessionUser;
    created: boolean;
    changed: boolean;
  } {
    const matchingUsers = this.users.filter(
      (user) =>
        (sessionUser.seatId != null && user.seatId === sessionUser.seatId) ||
        (sessionUser.userId != null && user.userId === sessionUser.userId) ||
        (sessionUser.socketId !== '' && user.socketId === sessionUser.socketId),
    );
    const existingUser =
      matchingUsers.find(
        (user) =>
          sessionUser.seatId != null && user.seatId === sessionUser.seatId,
      ) ??
      matchingUsers.find(
        (user) =>
          sessionUser.userId != null && user.userId === sessionUser.userId,
      ) ??
      matchingUsers[0];

    if (!existingUser) {
      this.users.push(sessionUser);
      if (sessionUser.userId && sessionUser.seatId) {
        this.seatIdsByToken.set(sessionUser.userId, sessionUser.seatId);
      }
      return {
        user: sessionUser,
        created: true,
        changed: true,
      };
    }

    const nextUserId = sessionUser.userId ?? existingUser.userId;
    const nextIsAuthenticated =
      sessionUser.isAuthenticated ?? existingUser.isAuthenticated;
    const previousSeatId = existingUser.seatId;
    const previousUserId = existingUser.userId;
    const changed =
      existingUser.socketId !== sessionUser.socketId ||
      existingUser.seatId !== sessionUser.seatId ||
      existingUser.name !== sessionUser.name ||
      existingUser.userId !== nextUserId ||
      existingUser.isAuthenticated !== nextIsAuthenticated;

    if (changed) {
      existingUser.socketId = sessionUser.socketId;
      existingUser.seatId = sessionUser.seatId;
      existingUser.name = sessionUser.name;
      existingUser.userId = nextUserId;
      existingUser.isAuthenticated = nextIsAuthenticated;
    }

    if (
      previousUserId &&
      previousUserId !== sessionUser.userId &&
      this.seatIdsByToken.get(previousUserId) === previousSeatId
    ) {
      this.seatIdsByToken.delete(previousUserId);
    }

    if (sessionUser.userId && sessionUser.seatId) {
      this.seatIdsByToken.set(sessionUser.userId, sessionUser.seatId);
    }

    for (const duplicateUser of matchingUsers) {
      if (duplicateUser === existingUser) {
        continue;
      }
      if (
        duplicateUser.userId &&
        duplicateUser.userId !== sessionUser.userId &&
        this.seatIdsByToken.get(duplicateUser.userId) === duplicateUser.seatId
      ) {
        this.seatIdsByToken.delete(duplicateUser.userId);
      }
      const duplicateIndex = this.users.indexOf(duplicateUser);
      if (duplicateIndex !== -1) {
        this.users.splice(duplicateIndex, 1);
      }
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

  registerSeatToken(token: string, seatId: SeatId): void {
    this.seatIdsByToken.set(token, seatId);
  }

  removeSeatToken(seatId: SeatId): void {
    for (const [token, registeredSeatId] of this.seatIdsByToken.entries()) {
      if (registeredSeatId === seatId) {
        this.seatIdsByToken.delete(token);
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
      players.find((player) => player.seatId === sessionUser.seatId) || null
    );
  }

  findPlayerByReconnectToken(
    players: DomainPlayer[],
    token: string,
  ): DomainPlayer | null {
    const seatId = this.seatIdsByToken.get(token);
    if (seatId) {
      return players.find((player) => player.seatId === seatId) || null;
    }

    return players.find((player) => player.seatId === token) || null;
  }

  getPlayerConnectionState(seatId: SeatId): PlayerConnectionState | null {
    const sessionUser = this.findSessionUserBySeatId(seatId);
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
    seatId: SeatId,
    socketId: string,
    name: string,
    userId?: string,
    isAuthenticated?: boolean,
  ): SessionUser {
    const timeout = this.disconnectTimeoutsBySeatId.get(seatId);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectTimeoutsBySeatId.delete(seatId);
    }

    const existingUser = this.findSessionUserBySeatId(seatId);
    const resolvedUserId = userId ?? existingUser?.userId;
    const { user } = this.upsertSessionUser({
      socketId,
      seatId,
      name,
      userId: resolvedUserId,
      isAuthenticated:
        isAuthenticated ??
        existingUser?.isAuthenticated ??
        Boolean(resolvedUserId),
    });

    if (resolvedUserId) {
      this.logger.log(
        `[GameState] Updated seat ${seatId} with userId: ${resolvedUserId}`,
      );
    }

    return user;
  }

  applyConnectionState(
    seatId: SeatId,
    name: string,
    connectionState: PlayerConnectionState,
  ): SessionUser {
    return this.updatePlayerSocketId(
      seatId,
      connectionState.socketId,
      name,
      connectionState.userId,
      connectionState.isAuthenticated,
    );
  }

  setDisconnectTimeout(seatId: SeatId, timeout: NodeJS.Timeout): void {
    const existingTimeout = this.disconnectTimeoutsBySeatId.get(seatId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    this.disconnectTimeoutsBySeatId.set(seatId, timeout);
  }

  clearDisconnectTimeout(seatId: SeatId): void {
    const existingTimeout = this.disconnectTimeoutsBySeatId.get(seatId);
    if (!existingTimeout) {
      return;
    }

    clearTimeout(existingTimeout);
    this.disconnectTimeoutsBySeatId.delete(seatId);
  }

  clearAllDisconnectTimeouts(): void {
    for (const timeout of this.disconnectTimeoutsBySeatId.values()) {
      clearTimeout(timeout);
    }
    this.disconnectTimeoutsBySeatId.clear();
  }
}
