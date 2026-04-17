import type { GameStatePayload } from '@contracts/game';
import type {
  GamePlayerJoinedPayload,
  RoomPlayerJoinedPayload,
} from '@contracts/room';
import { Inject, Injectable } from '@nestjs/common';
import { GatewayEvent } from '../use-cases/interfaces/gateway-event.interface';
import {
  JoinRoomSuccess,
  PreviousRoomNotification,
} from '../use-cases/interfaces/join-room.use-case.interface';
import { resolveTransportPlayers } from '../use-cases/helpers/player-resolution.helper';
import { Team } from '../types/game.types';
import { SessionUser } from '../types/session.types';
import { RoomStatus } from '../types/room.types';
import { IRoomService } from './interfaces/room-service.interface';
import { RoomUpdateGatewayEffectsService } from './room-update-gateway-effects.service';

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
    playerId: string;
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

    if (currentRoomId && currentRoomId !== roomId) {
      events.push({
        scope: 'room',
        roomId: currentRoomId,
        event: 'player-left',
        payload: {
          playerId:
            previousRoomNotification?.playerId ?? normalizedUser.playerId,
          roomId: currentRoomId,
        },
      });
    }

    const joiningPlayer = room.players.find(
      (player) => player.playerId === normalizedUser.playerId,
    );
    const joiningTeam = joiningPlayer?.team ?? 0;

    const roomPlayerJoinedPayload: RoomPlayerJoinedPayload = {
      playerId: normalizedUser.playerId,
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
      playerId: normalizedUser.playerId,
      roomId,
      isHost: joinData.isHost,
      roomStatus: joinData.roomStatus,
      isSelf: true,
      team: joiningTeam,
      name: normalizedUser.name,
    };
    events.push({
      scope: 'socket',
      socketId: clientId,
      event: 'game-player-joined',
      payload: selfJoinedPayload,
    });

    const otherJoinedPayload: GamePlayerJoinedPayload = {
      playerId: normalizedUser.playerId,
      roomId,
      isHost: joinData.isHost,
      roomStatus: joinData.roomStatus,
      team: joiningTeam,
      name: normalizedUser.name,
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
        if (existingPlayer.playerId === normalizedUser.playerId) {
          continue;
        }

        const existingPlayerJoinedPayload: GamePlayerJoinedPayload = {
          playerId: existingPlayer.playerId,
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
      const maskedGameStateForJoiner: GameStatePayload = {
        ...joinData.resumeGame.gameState,
        currentField: joinData.resumeGame.gameState.currentField ?? null,
        negriCard: joinData.resumeGame.gameState.negriCard ?? null,
        fields: joinData.resumeGame.gameState.fields ?? [],
        players: resolveTransportPlayers(
          roomGameState,
          joinData.resumeGame.gameState.players,
          {
            roomPlayers: room.players,
          },
        ).map((player) => ({
          ...player,
          hand: player.playerId === normalizedUser.playerId ? player.hand : [],
        })),
        you: normalizedUser.playerId,
        hostId: room.hostId,
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
    }

    return {
      room,
      events,
    };
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
        playerId: selfPlayer.playerId,
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
