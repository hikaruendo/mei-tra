import type {
  GameStatePayload,
  ReconnectionFailureCode,
} from '@contracts/game';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IGameStateService } from '../services/interfaces/game-state-service.interface';
import { GameStateService } from '../services/game-state.service';
import { RoomPlayer, RoomStatus } from '../types/room.types';
import { AuthenticatedUser } from '../types/user.types';
import {
  resolvePlayerByActorId,
  resolveTransportPlayers,
} from './helpers/player-resolution.helper';
import { DomainPlayer, Team } from '../types/game.types';

export type ReconnectionResult =
  | {
      success: true;
      roomId: string;
      roomsList: Awaited<ReturnType<IRoomService['listRooms']>>;
      mode: 'waiting-room';
      room: NonNullable<Awaited<ReturnType<IRoomService['getRoom']>>>;
      selfPlayerId: string;
      selfName: string;
      selfTeam: Team;
      isHost: boolean;
    }
  | {
      success: true;
      roomId: string;
      roomsList: Awaited<ReturnType<IRoomService['listRooms']>>;
      mode: 'active-game';
      room: NonNullable<Awaited<ReturnType<IRoomService['getRoom']>>>;
      gameState: GameStatePayload;
      reconnectToken: string;
      currentTurnPlayerId: string | null;
      selfPlayerId: string;
    }
  | {
      success: false;
      code: ReconnectionFailureCode;
      reason: string;
      roomId?: string;
    };

type ActiveGameReconnection = Extract<
  ReconnectionResult,
  { success: true; mode: 'active-game' }
>;

export type ActiveGameSnapshot = Pick<
  ActiveGameReconnection,
  'gameState' | 'reconnectToken' | 'currentTurnPlayerId' | 'selfPlayerId'
>;

type ActiveRoom = NonNullable<Awaited<ReturnType<IRoomService['getRoom']>>>;

@Injectable()
export class ReconnectionUseCase {
  private readonly logger = new Logger(ReconnectionUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IGameStateService')
    private readonly gameState: IGameStateService,
  ) {}

  async execute(request: {
    roomId: string;
    socketId: string;
    authenticatedUser: AuthenticatedUser;
  }): Promise<ReconnectionResult> {
    const { roomId, socketId, authenticatedUser } = request;

    try {
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return {
          success: false,
          code: 'roomUnavailable',
          roomId,
          reason:
            'Your previous room session is no longer available. Please join or create a room again.',
        };
      }

      const state = roomGameState.getState();
      const isActiveGame =
        room.status === RoomStatus.PLAYING &&
        state.gamePhase !== null &&
        state.gamePhase !== 'waiting';

      if (!isActiveGame) {
        try {
          await roomGameState.reconcileWaitingRoomPlayers(room.players);
          await this.roomService.initCOMPlaceholders(roomId);
        } catch (error) {
          this.logger.error(
            `[Reconnection] Failed to reconcile waiting room=${roomId} user=${authenticatedUser.id}: ${String(error)}`,
          );
          return {
            success: false,
            code: 'stateInconsistent',
            roomId,
            reason: 'Failed to reconcile the waiting-room roster',
          };
        }
        const updatedRoom = await this.roomService.getRoom(roomId);
        if (!updatedRoom) {
          return {
            success: false,
            code: 'roomUnavailable',
            roomId,
            reason:
              'Your previous room session is no longer available. Please join or create a room again.',
          };
        }

        const existingWaitingPlayer = this.resolveWaitingRoomPlayer(
          roomGameState,
          updatedRoom.players,
          authenticatedUser.id,
        );

        if (!existingWaitingPlayer) {
          return {
            success: false,
            code: 'sessionInvalid',
            roomId,
            reason:
              'Your previous room session is no longer valid. Please join or create a room again.',
          };
        }

        const reconnectResult = await this.roomService.handlePlayerReconnection(
          roomId,
          existingWaitingPlayer.playerId,
          socketId,
          authenticatedUser.id,
        );
        if (!reconnectResult.success) {
          this.logStateMismatch(
            roomId,
            authenticatedUser.id,
            existingWaitingPlayer.playerId,
            updatedRoom.players.length,
            roomGameState.getState().players.length,
            reconnectResult.error,
          );
          return {
            success: false,
            code: 'stateInconsistent',
            roomId,
            reason: 'Failed to reconnect',
          };
        }

        this.syncGlobalConnectionUser(socketId, authenticatedUser);

        return {
          success: true,
          mode: 'waiting-room',
          roomId,
          roomsList: await this.roomService.listRooms(),
          room: updatedRoom,
          selfPlayerId: existingWaitingPlayer.playerId,
          selfName: existingWaitingPlayer.name,
          selfTeam: existingWaitingPlayer.team,
          isHost: updatedRoom.hostId === existingWaitingPlayer.playerId,
        };
      }

      const existingPlayer = this.resolveActiveGamePlayer(
        roomGameState,
        room,
        authenticatedUser.id,
      );
      if (!existingPlayer) {
        const persistedRoomPlayer = this.resolveAuthenticatedRoomPlayer(
          room.players,
          authenticatedUser.id,
        );
        return {
          success: false,
          code: persistedRoomPlayer ? 'stateInconsistent' : 'sessionInvalid',
          roomId,
          reason:
            'Your previous room session is no longer valid. Please join or create a room again.',
        };
      }

      const reconnectResult = await this.roomService.handlePlayerReconnection(
        roomId,
        existingPlayer.playerId,
        socketId,
        authenticatedUser.id,
      );
      if (!reconnectResult.success) {
        this.logStateMismatch(
          roomId,
          authenticatedUser.id,
          existingPlayer.playerId,
          room.players.length,
          state.players.length,
          reconnectResult.error,
        );
        return {
          success: false,
          code: 'stateInconsistent',
          roomId,
          reason: 'Failed to reconnect',
        };
      }

      this.syncGlobalConnectionUser(socketId, authenticatedUser);

      return {
        success: true,
        mode: 'active-game',
        roomId,
        roomsList: await this.roomService.listRooms(),
        room,
        ...this.buildActiveGameSnapshot(
          roomId,
          room,
          roomGameState,
          existingPlayer,
        ),
      };
    } catch (error) {
      this.logger.warn(
        `[Reconnection] Failed to reconnect room=${roomId} user=${authenticatedUser.id}: ${String(error)}`,
      );
      return {
        success: false,
        code: 'roomUnavailable',
        roomId,
        reason:
          'Your previous room session is no longer available. Please join or create a room again.',
      };
    }
  }

  async getActiveGameSnapshot(request: {
    roomId: string;
    authenticatedUser: AuthenticatedUser;
  }): Promise<ActiveGameSnapshot | null> {
    const { roomId, authenticatedUser } = request;

    try {
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return null;
      }

      const state = roomGameState.getState();
      const isActiveGame =
        room.status === RoomStatus.PLAYING &&
        state.gamePhase !== null &&
        state.gamePhase !== 'waiting';
      if (!isActiveGame) {
        return null;
      }

      const existingPlayer = this.resolveActiveGamePlayer(
        roomGameState,
        room,
        authenticatedUser.id,
      );
      if (!existingPlayer) {
        return null;
      }

      return this.buildActiveGameSnapshot(
        roomId,
        room,
        roomGameState,
        existingPlayer,
      );
    } catch (error) {
      this.logger.warn(
        `[Reconnection] Failed to load active snapshot room=${roomId} user=${authenticatedUser.id}: ${String(error)}`,
      );
      return null;
    }
  }

  private resolveActiveGamePlayer(
    roomGameState: GameStateService,
    room: ActiveRoom,
    authenticatedUserId: string,
  ): DomainPlayer | null {
    const persistedRoomPlayer = this.resolveAuthenticatedRoomPlayer(
      room.players,
      authenticatedUserId,
    );

    return persistedRoomPlayer
      ? (roomGameState
          .getState()
          .players.find(
            (player) => player.playerId === persistedRoomPlayer.playerId,
          ) ?? null)
      : resolvePlayerByActorId(roomGameState, authenticatedUserId);
  }

  private buildActiveGameSnapshot(
    roomId: string,
    room: ActiveRoom,
    roomGameState: GameStateService,
    player: DomainPlayer,
  ): ActiveGameSnapshot {
    const state = roomGameState.getState();
    const currentTurnPlayerId =
      state.currentPlayerIndex !== -1 && state.players[state.currentPlayerIndex]
        ? state.players[state.currentPlayerIndex].playerId
        : null;

    return {
      selfPlayerId: player.playerId,
      reconnectToken: player.playerId,
      currentTurnPlayerId,
      gameState: {
        players: resolveTransportPlayers(roomGameState, state.players, {
          roomPlayers: room.players,
          mapHand: (transportPlayer) =>
            transportPlayer.playerId === player.playerId
              ? transportPlayer.hand
              : [],
        }),
        gamePhase: state.gamePhase || 'waiting',
        currentField: state.playState?.currentField ?? null,
        currentTurn: currentTurnPlayerId,
        blowState: state.blowState,
        teamScores: state.teamScores,
        you: player.playerId,
        negriCard: state.playState?.negriCard ?? null,
        fields: state.playState?.fields ?? [],
        roomId,
        hostId: room.hostId,
        pointsToWin: state.pointsToWin,
        teamNames: room.settings.teamNames,
      },
    };
  }

  private syncGlobalConnectionUser(
    socketId: string,
    authenticatedUser: AuthenticatedUser,
  ): void {
    const displayName =
      authenticatedUser.profile?.displayName ||
      authenticatedUser.email ||
      'User';

    this.gameState.upsertSessionUser({
      socketId,
      playerId: authenticatedUser.id,
      name: displayName,
      userId: authenticatedUser.id,
      isAuthenticated: true,
    });
  }

  private resolveWaitingRoomPlayer(
    roomGameState: Pick<
      IGameStateService,
      'findSessionUserByUserId' | 'findSessionUserByPlayerId'
    >,
    roomPlayers: RoomPlayer[],
    authenticatedUserId: string,
  ): RoomPlayer | null {
    const sessionUser =
      roomGameState.findSessionUserByUserId(authenticatedUserId) ??
      roomGameState.findSessionUserByPlayerId(authenticatedUserId);

    if (sessionUser) {
      const sessionMatchedPlayer =
        roomPlayers.find(
          (player) => player.playerId === sessionUser.playerId,
        ) ?? null;
      if (sessionMatchedPlayer) {
        return sessionMatchedPlayer;
      }
    }

    const authenticatedMatches = roomPlayers.filter(
      (player) =>
        player.isAuthenticated && player.userId === authenticatedUserId,
    );

    return authenticatedMatches.length === 1 ? authenticatedMatches[0] : null;
  }

  private resolveAuthenticatedRoomPlayer(
    roomPlayers: RoomPlayer[],
    authenticatedUserId: string,
  ): RoomPlayer | null {
    const matches = roomPlayers.filter(
      (player) =>
        player.isAuthenticated && player.userId === authenticatedUserId,
    );

    return matches.length === 1 ? matches[0] : null;
  }

  private logStateMismatch(
    roomId: string,
    userId: string,
    playerId: string,
    roomPlayerCount: number,
    statePlayerCount: number,
    error?: string,
  ): void {
    this.logger.error(
      `[Reconnection] State mismatch room=${roomId} user=${userId} player=${playerId} roomPlayers=${roomPlayerCount} statePlayers=${statePlayerCount} error=${error ?? 'unknown'}`,
    );
  }
}
