import type {
  GamePlayerJoinedPayload,
  RoomPlayerJoinedPayload,
} from '@contracts/room';
import type { GameStatePayload } from '@contracts/game';
import type { SeatId } from '@contracts/ids';
import { Inject, Injectable } from '@nestjs/common';
import { GatewayEvent } from '../use-cases/interfaces/gateway-event.interface';
import {
  JoinRoomSuccess,
  PreviousRoomNotification,
} from '../use-cases/interfaces/join-room.use-case.interface';
import { resolveTransportPlayers } from '../use-cases/helpers/player-resolution.helper';
import { DomainPlayer, Team } from '../types/game.types';
import { SessionUser } from '../types/session.types';
import { RoomPlayer, RoomStatus } from '../types/room.types';
import { IRoomService } from './interfaces/room-service.interface';
import { RoomUpdateGatewayEffectsService } from './room-update-gateway-effects.service';
import { asSeatId } from '../types/identity.types';
import {
  toBlowStateContract,
  toBlowUpdatedPayload,
  toCompletedFieldContract,
  toFieldContract,
} from '../adapters/game-contract-adapters';

interface BuildJoinRoomEffectsParams {
  clientId: string;
  roomId: string;
  currentRoomId?: string;
  normalizedUser: SessionUser;
  previousRoomNotification?: PreviousRoomNotification;
  joinData: JoinRoomSuccess;
}

interface JoinRoomEffectsResult {
  room: JoinRoomSuccess['room'];
  events: GatewayEvent[];
}

interface BuildRoomEntryEventsParams {
  clientId: string;
  room: JoinRoomSuccess['room'];
  selfPlayer: {
    seatId: SeatId;
    name: string;
    team: Team;
  };
  isHost: boolean;
  roomStatus: JoinRoomSuccess['roomStatus'];
  roomsList: JoinRoomSuccess['roomsList'];
  roomsListScope: 'socket' | 'all';
}

interface BuildActiveReconnectEventsParams {
  clientId: string;
  roomId: string;
  room: JoinRoomSuccess['room'];
  gameState: GameStatePayload;
  reconnectToken: string;
}

@Injectable()
export class JoinRoomGatewayEffectsService {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    private readonly roomUpdateGatewayEffectsService: RoomUpdateGatewayEffectsService,
  ) {}

  async buildEffects({
    clientId,
    roomId,
    currentRoomId,
    normalizedUser,
    previousRoomNotification,
    joinData,
  }: BuildJoinRoomEffectsParams): Promise<JoinRoomEffectsResult> {
    const events: GatewayEvent[] = [];
    let room = joinData.room;
    const selfRoomPlayer = this.resolveSelfRoomPlayer(room, normalizedUser);
    if (!selfRoomPlayer) {
      throw new Error(
        `Joined seat could not be resolved: room=${roomId} user=${normalizedUser.userId ?? 'unknown'}`,
      );
    }
    const selfPlayerId = selfRoomPlayer.seatId;

    if (currentRoomId && currentRoomId !== roomId && previousRoomNotification) {
      events.push({
        scope: 'room',
        roomId: currentRoomId,
        event: 'player-left',
        payload: {
          seatId: asSeatId(previousRoomNotification.playerId),
          roomId: currentRoomId,
        },
      });
    }

    const joiningTeam = selfRoomPlayer?.team;

    const roomPlayerJoinedPayload: RoomPlayerJoinedPayload = {
      seatId: asSeatId(selfPlayerId),
      roomId,
      isHost: joinData.isHost,
    };

    events.push({
      scope: 'room',
      roomId,
      event: 'room-player-joined',
      payload: roomPlayerJoinedPayload,
    });

    const selfJoinedPayload: GamePlayerJoinedPayload = {
      seatId: asSeatId(selfPlayerId),
      roomId,
      isHost: joinData.isHost,
      roomStatus: joinData.roomStatus,
      isSelf: true,
      team: joiningTeam,
      name: selfRoomPlayer?.name ?? normalizedUser.name,
    };
    events.push({
      scope: 'socket',
      socketId: clientId,
      event: 'game-player-joined',
      payload: selfJoinedPayload,
    });

    const otherJoinedPayload: GamePlayerJoinedPayload = {
      seatId: asSeatId(selfPlayerId),
      roomId,
      isHost: joinData.isHost,
      roomStatus: joinData.roomStatus,
      team: joiningTeam,
      name: selfRoomPlayer?.name ?? normalizedUser.name,
    };
    events.push({
      scope: 'room',
      roomId,
      excludeSocketId: clientId,
      event: 'game-player-joined',
      payload: otherJoinedPayload,
    });

    if (!joinData.resumeGame) {
      for (const existingPlayer of room.players) {
        if (existingPlayer.seatId === selfPlayerId) {
          continue;
        }

        const existingPlayerJoinedPayload: GamePlayerJoinedPayload = {
          seatId: asSeatId(existingPlayer.seatId),
          roomId,
          isHost: existingPlayer.isHost,
          roomStatus: joinData.roomStatus,
          team: existingPlayer.team,
          name: existingPlayer.name,
          isCOM: existingPlayer.isCOM ?? false,
          isReady: existingPlayer.isReady ?? false,
        };
        events.push({
          scope: 'socket',
          socketId: clientId,
          event: 'game-player-joined',
          payload: existingPlayerJoinedPayload,
        });
      }
    }

    if (!joinData.resumeGame && joinData.roomStatus === RoomStatus.WAITING) {
      await this.roomService.initCOMPlaceholders(roomId);
      const updatedRoom = await this.roomService.getRoom(roomId);
      if (updatedRoom) {
        const roomGameState = await this.roomService.getRoomGameState(roomId);
        room = updatedRoom;
        events.push(
          ...(await this.roomUpdateGatewayEffectsService.buildRoomEvents({
            room: updatedRoom,
            statePlayers: roomGameState.getState().players,
            scope: 'room',
            roomId,
          })),
        );
      }
    }

    events.push(
      this.roomUpdateGatewayEffectsService.buildRoomsListEvent({
        rooms: joinData.roomsList,
        scope: 'all',
      }),
    );
    events.push({
      scope: 'room',
      roomId,
      event: 'set-room-id',
      payload: roomId,
    });

    if (joinData.resumeGame) {
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const resumeSelfPlayerId = this.resolveResumeSelfPlayerId(
        room,
        joinData.resumeGame.gameState.players,
        normalizedUser,
      );
      const maskedGameStateForJoiner: GameStatePayload = {
        ...joinData.resumeGame.gameState,
        currentTurnSeatId:
          joinData.resumeGame.gameState.currentTurnSeatId ?? null,
        currentField: joinData.resumeGame.gameState.currentField
          ? toFieldContract(joinData.resumeGame.gameState.currentField)
          : null,
        negriCard: joinData.resumeGame.gameState.negriCard ?? null,
        fields: (joinData.resumeGame.gameState.fields ?? []).map(
          toCompletedFieldContract,
        ),
        players: resolveTransportPlayers(
          roomGameState,
          joinData.resumeGame.gameState.players,
          {
            roomPlayers: room.players,
          },
        ).map((player) => ({
          ...player,
          hand:
            player.seatId === asSeatId(resumeSelfPlayerId) ? player.hand : [],
        })),
        blowState: toBlowStateContract(joinData.resumeGame.gameState.blowState),
        youSeatId: resumeSelfPlayerId ? asSeatId(resumeSelfPlayerId) : null,
        hostSeatId: asSeatId(room.hostSeatId),
      };

      events.push({
        scope: 'socket',
        socketId: clientId,
        event: 'game-resumed',
        payload: {
          message: joinData.resumeGame.message,
        },
      });
      events.push({
        scope: 'socket',
        socketId: clientId,
        event: 'game-state',
        payload: maskedGameStateForJoiner,
      });
      events.push({
        scope: 'room',
        roomId,
        excludeSocketId: clientId,
        event: 'update-players',
        payload: resolveTransportPlayers(
          roomGameState,
          joinData.resumeGame.gameState.players,
          {
            roomPlayers: room.players,
          },
        ),
      });
      events.push({
        scope: 'room',
        roomId,
        event: 'blow-updated',
        payload: toBlowUpdatedPayload(joinData.resumeGame.gameState.blowState),
      });
      if (joinData.resumeGame.gameState.currentTurnSeatId) {
        events.push({
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: joinData.resumeGame.gameState.currentTurnSeatId,
        });
      }
    }

    return {
      room,
      events,
    };
  }

  private resolveSelfRoomPlayer(
    room: JoinRoomSuccess['room'],
    normalizedUser: SessionUser,
  ): RoomPlayer | undefined {
    if (normalizedUser.userId) {
      const playersByUserId = room.players.filter(
        (player) => !player.isCOM && player.userId === normalizedUser.userId,
      );
      if (playersByUserId.length === 1) {
        return playersByUserId[0];
      }
    }

    return room.players.find(
      (player) => player.seatId === normalizedUser.seatId,
    );
  }

  private resolveResumeSelfPlayerId(
    room: JoinRoomSuccess['room'],
    gamePlayers: DomainPlayer[],
    normalizedUser: SessionUser,
  ): string {
    const gamePlayerIds = new Set(gamePlayers.map((player) => player.seatId));

    const selfRoomPlayer = this.resolveSelfRoomPlayer(room, normalizedUser);
    if (selfRoomPlayer && gamePlayerIds.has(selfRoomPlayer.seatId)) {
      return selfRoomPlayer.seatId;
    }

    if (normalizedUser.seatId && gamePlayerIds.has(normalizedUser.seatId)) {
      return normalizedUser.seatId;
    }

    throw new Error(
      `Resume seat could not be resolved: room=${room.id} user=${normalizedUser.userId ?? 'unknown'}`,
    );
  }

  async buildRoomEntryEvents({
    clientId,
    room,
    selfPlayer,
    isHost,
    roomStatus,
    roomsList,
    roomsListScope,
  }: BuildRoomEntryEventsParams): Promise<GatewayEvent[]> {
    const events = await this.roomUpdateGatewayEffectsService.buildRoomEvents({
      room,
      scope: 'socket',
      socketId: clientId,
    });

    events.push({
      scope: 'socket',
      socketId: clientId,
      event: 'game-player-joined',
      payload: {
        seatId: selfPlayer.seatId,
        roomId: room.id,
        isHost,
        roomStatus,
        isSelf: true,
        team: selfPlayer.team,
        name: selfPlayer.name,
      } satisfies GamePlayerJoinedPayload,
    });
    events.push({
      scope: 'socket',
      socketId: clientId,
      event: 'set-room-id',
      payload: room.id,
    });
    events.push(
      this.roomUpdateGatewayEffectsService.buildRoomsListEvent({
        rooms: roomsList,
        scope: roomsListScope,
        socketId: roomsListScope === 'socket' ? clientId : undefined,
      }),
    );

    return events;
  }

  async buildActiveReconnectEvents({
    clientId,
    roomId,
    room,
    gameState,
    reconnectToken,
  }: BuildActiveReconnectEventsParams): Promise<GatewayEvent[]> {
    const activeRoomEvents =
      await this.roomUpdateGatewayEffectsService.buildRoomEvents({
        room,
        scope: 'room',
        roomId,
      });

    return [
      {
        scope: 'socket',
        socketId: clientId,
        event: 'game-state',
        payload: gameState,
      },
      {
        scope: 'socket',
        socketId: clientId,
        event: 'reconnect-token',
        payload: reconnectToken,
      },
      ...activeRoomEvents.filter(
        (event) =>
          event.event === 'room-sync' || event.event === 'update-players',
      ),
    ];
  }
}
