import type { ReconnectionFailureCode } from '@contracts/game';
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
import { DomainPlayer, GamePhase, Team } from '../types/game.types';
import { RoomMembershipService } from '../services/room-membership.service';
import { asSeatId, type SeatId } from '../types/identity.types';
import { resolveCurrentSeatId } from '../domain/current-turn';
import type { GameStatePayload } from '@contracts/game';
import {
  toBlowStateContract,
  toCompletedFieldContract,
  toFieldContract,
} from '../adapters/game-contract-adapters';

export type ReconnectionResult =
  | {
      success: true;
      roomId: string;
      roomsList: Awaited<ReturnType<IRoomService['listRooms']>>;
      mode: 'waiting-room';
      room: NonNullable<Awaited<ReturnType<IRoomService['getRoom']>>>;
      selfSeatId: SeatId;
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
      currentTurnSeatId: SeatId | null;
      selfSeatId: SeatId;
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

type WaitingRoomReconnection = Extract<
  ReconnectionResult,
  { success: true; mode: 'waiting-room' }
>;

export type ActiveGameSnapshot = Pick<
  ActiveGameReconnection,
  'gameState' | 'reconnectToken' | 'currentTurnSeatId' | 'selfSeatId'
>;

export type WaitingRoomSnapshot = Pick<
  WaitingRoomReconnection,
  | 'roomId'
  | 'roomsList'
  | 'room'
  | 'selfSeatId'
  | 'selfName'
  | 'selfTeam'
  | 'isHost'
>;

type ActiveRoom = NonNullable<Awaited<ReturnType<IRoomService['getRoom']>>>;

@Injectable()
export class ReconnectionUseCase {
  private readonly logger = new Logger(ReconnectionUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IGameStateService')
    private readonly gameState: IGameStateService,
    private readonly roomMembershipService: RoomMembershipService,
  ) {}

  async execute(request: {
    roomId: string;
    socketId: string;
    authenticatedUser: AuthenticatedUser;
  }): Promise<ReconnectionResult> {
    const { roomId, socketId, authenticatedUser } = request;

    try {
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
      const roomGameState = await this.roomService.getRoomGameState(roomId);

      const state = roomGameState.getState();
      const isActiveGame = this.isActiveGame(room, state.gamePhase);

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

        if (
          !(await this.claimMembership(
            authenticatedUser.id,
            roomId,
            existingWaitingPlayer.seatId,
          ))
        ) {
          return this.buildMembershipConflict(roomId);
        }

        const reconnectResult = await this.roomService.handlePlayerReconnection(
          roomId,
          existingWaitingPlayer.seatId,
          socketId,
          authenticatedUser.id,
          this.resolveDisplayName(authenticatedUser),
        );
        if (!reconnectResult.success) {
          this.logStateMismatch(
            roomId,
            authenticatedUser.id,
            existingWaitingPlayer.seatId,
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

        this.syncGlobalConnectionUser(
          socketId,
          authenticatedUser,
          existingWaitingPlayer.seatId,
        );

        const reconnectedRoom = await this.roomService.getRoom(roomId);
        const reconnectedPlayer = reconnectedRoom?.players.find(
          (player) => player.seatId === existingWaitingPlayer.seatId,
        );
        if (!reconnectedRoom || !reconnectedPlayer) {
          return {
            success: false,
            code: 'stateInconsistent',
            roomId,
            reason: 'Failed to reload the reconnected waiting-room player',
          };
        }

        return {
          success: true,
          mode: 'waiting-room',
          roomId,
          roomsList: await this.roomService.listRooms(),
          room: reconnectedRoom,
          selfSeatId: asSeatId(reconnectedPlayer.seatId),
          selfName: reconnectedPlayer.name,
          selfTeam: reconnectedPlayer.team,
          isHost: reconnectedRoom.hostSeatId === reconnectedPlayer.seatId,
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

      if (
        !(await this.claimMembership(
          authenticatedUser.id,
          roomId,
          existingPlayer.seatId,
        ))
      ) {
        return this.buildMembershipConflict(roomId);
      }

      const reconnectResult = await this.roomService.handlePlayerReconnection(
        roomId,
        existingPlayer.seatId,
        socketId,
        authenticatedUser.id,
        this.resolveDisplayName(authenticatedUser),
      );
      if (!reconnectResult.success) {
        this.logStateMismatch(
          roomId,
          authenticatedUser.id,
          existingPlayer.seatId,
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

      this.syncGlobalConnectionUser(
        socketId,
        authenticatedUser,
        existingPlayer.seatId,
      );

      const reconnectedRoom = await this.roomService.getRoom(roomId);
      const reconnectedPlayer = roomGameState
        .getState()
        .players.find((player) => player.seatId === existingPlayer.seatId);
      if (!reconnectedRoom || !reconnectedPlayer) {
        return {
          success: false,
          code: 'stateInconsistent',
          roomId,
          reason: 'Failed to reload the reconnected active-game player',
        };
      }

      return {
        success: true,
        mode: 'active-game',
        roomId,
        roomsList: await this.roomService.listRooms(),
        room: reconnectedRoom,
        ...this.buildActiveGameSnapshot(
          roomId,
          reconnectedRoom,
          roomGameState,
          reconnectedPlayer,
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
      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return null;
      }
      const roomGameState = await this.roomService.getRoomGameState(roomId);

      const state = roomGameState.getState();
      const isActiveGame = this.isActiveGame(room, state.gamePhase);
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

  async getWaitingRoomSnapshot(request: {
    roomId: string;
    authenticatedUser: AuthenticatedUser;
  }): Promise<WaitingRoomSnapshot | null> {
    const { roomId, authenticatedUser } = request;

    try {
      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return null;
      }
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const isActiveGame = this.isActiveGame(room, state.gamePhase);
      if (isActiveGame) {
        return null;
      }

      const existingPlayer = this.resolveWaitingRoomPlayer(
        roomGameState,
        room.players,
        authenticatedUser.id,
      );
      if (!existingPlayer) {
        return null;
      }

      return {
        roomId,
        roomsList: await this.roomService.listRooms(),
        room,
        selfSeatId: asSeatId(existingPlayer.seatId),
        selfName: existingPlayer.name,
        selfTeam: existingPlayer.team,
        isHost: room.hostSeatId === existingPlayer.seatId,
      };
    } catch (error) {
      this.logger.warn(
        `[Reconnection] Failed to load waiting-room snapshot room=${roomId} user=${authenticatedUser.id}: ${String(error)}`,
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
            (player) => player.seatId === persistedRoomPlayer.seatId,
          ) ?? null)
      : resolvePlayerByActorId(roomGameState, authenticatedUserId);
  }

  private isActiveGame(room: ActiveRoom, gamePhase: GamePhase): boolean {
    return (
      room.status === RoomStatus.PLAYING &&
      gamePhase !== null &&
      gamePhase !== 'waiting'
    );
  }

  private buildActiveGameSnapshot(
    roomId: string,
    room: ActiveRoom,
    roomGameState: GameStateService,
    player: DomainPlayer,
  ): ActiveGameSnapshot {
    const state = roomGameState.getState();
    const currentTurnSeatId = resolveCurrentSeatId(state);

    return {
      selfSeatId: asSeatId(player.seatId),
      reconnectToken: player.seatId,
      currentTurnSeatId: currentTurnSeatId ? asSeatId(currentTurnSeatId) : null,
      gameState: {
        players: resolveTransportPlayers(roomGameState, state.players, {
          roomPlayers: room.players,
          mapHand: (transportPlayer) =>
            transportPlayer.seatId === asSeatId(player.seatId)
              ? transportPlayer.hand
              : [],
        }),
        gamePhase: state.gamePhase || 'waiting',
        currentField: state.playState?.currentField
          ? toFieldContract(state.playState.currentField)
          : null,
        currentTurnSeatId: currentTurnSeatId
          ? asSeatId(currentTurnSeatId)
          : null,
        blowState: toBlowStateContract(state.blowState),
        teamScores: state.teamScores,
        youSeatId: asSeatId(player.seatId),
        negriCard: state.playState?.negriCard ?? null,
        negriSeatId: state.playState?.negriSeatId
          ? asSeatId(state.playState.negriSeatId)
          : null,
        revealedAgari:
          state.gamePhase === 'play' &&
          !state.playState?.negriCard &&
          state.blowState.currentHighestDeclaration?.seatId === player.seatId
            ? (state.agari ?? null)
            : null,
        fields: (state.playState?.fields ?? []).map(toCompletedFieldContract),
        roomId,
        hostSeatId: asSeatId(room.hostSeatId),
        pointsToWin: state.pointsToWin,
        teamNames: room.settings.teamNames,
      },
    };
  }

  private syncGlobalConnectionUser(
    socketId: string,
    authenticatedUser: AuthenticatedUser,
    seatId: SeatId,
  ): void {
    const displayName = this.resolveDisplayName(authenticatedUser);

    this.gameState.upsertSessionUser({
      socketId,
      seatId,
      name: displayName,
      userId: authenticatedUser.id,
      isAuthenticated: true,
    });
  }

  private resolveDisplayName(authenticatedUser: AuthenticatedUser): string {
    return (
      authenticatedUser.profile?.displayName ||
      authenticatedUser.email ||
      'User'
    );
  }

  private async claimMembership(
    userId: string,
    roomId: string,
    seatId: SeatId,
  ): Promise<boolean> {
    const transition = await this.roomMembershipService.claim(
      userId,
      roomId,
      seatId,
    );
    return transition.result !== 'conflict';
  }

  private buildMembershipConflict(roomId: string): ReconnectionResult {
    return {
      success: false,
      code: 'sessionInvalid',
      roomId,
      reason:
        'Your account is active in another room. Leave that room before reconnecting here.',
    };
  }

  private resolveWaitingRoomPlayer(
    roomGameState: Pick<IGameStateService, 'findSessionUserByUserId'>,
    roomPlayers: RoomPlayer[],
    authenticatedUserId: string,
  ): RoomPlayer | null {
    const authenticatedMatches = roomPlayers.filter(
      (player) => player.userId === authenticatedUserId,
    );
    if (authenticatedMatches.length === 1) {
      return authenticatedMatches[0];
    }
    if (authenticatedMatches.length > 1) {
      return null;
    }

    const sessionUser =
      roomGameState.findSessionUserByUserId(authenticatedUserId);

    if (sessionUser) {
      const sessionMatchedPlayer =
        roomPlayers.find((player) => player.seatId === sessionUser.seatId) ??
        null;
      if (sessionMatchedPlayer) {
        return sessionMatchedPlayer;
      }
    }

    return null;
  }

  private resolveAuthenticatedRoomPlayer(
    roomPlayers: RoomPlayer[],
    authenticatedUserId: string,
  ): RoomPlayer | null {
    const matches = roomPlayers.filter(
      (player) => player.userId === authenticatedUserId,
    );

    return matches.length === 1 ? matches[0] : null;
  }

  private logStateMismatch(
    roomId: string,
    userId: string,
    seatId: SeatId,
    roomPlayerCount: number,
    statePlayerCount: number,
    error?: string,
  ): void {
    this.logger.error(
      `[Reconnection] State mismatch room=${roomId} user=${userId} seat=${seatId} roomPlayers=${roomPlayerCount} statePlayers=${statePlayerCount} error=${error ?? 'unknown'}`,
    );
  }
}
