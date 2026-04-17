import { Inject, Injectable, Logger } from '@nestjs/common';
import { GatewayEvent } from '../use-cases/interfaces/gateway-event.interface';
import { DomainPlayer, GamePhase } from '../types/game.types';
import { Room, RoomStatus } from '../types/room.types';
import { IRoomService } from './interfaces/room-service.interface';
import { RoomUpdateGatewayEffectsService } from './room-update-gateway-effects.service';

export type DisconnectTimeoutMode = 'convert-to-com' | 'remove-player';

export interface DisconnectPreparation {
  playerId: string;
  playerName: string;
  roomGameState: Awaited<ReturnType<IRoomService['getRoomGameState']>>;
  timeoutMode: DisconnectTimeoutMode;
  events: GatewayEvent[];
}

@Injectable()
export class DisconnectGatewayEffectsService {
  private readonly logger = new Logger(DisconnectGatewayEffectsService.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    private readonly roomUpdateGatewayEffectsService: RoomUpdateGatewayEffectsService,
  ) {}

  async prepareDisconnect(params: {
    roomId: string;
    socketId: string;
    displayName?: string;
  }): Promise<DisconnectPreparation | null> {
    const { roomId, socketId, displayName } = params;
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    const players = await this.sanitizePlayers(
      roomId,
      state.players,
      roomGameState,
    );
    const room = await this.roomService.getRoom(roomId);
    const player = this.findPlayerForDisconnect(
      socketId,
      roomGameState,
      room,
      players,
    );

    if (!player) {
      return null;
    }

    state.teamAssignments[player.playerId] = player.team;
    await roomGameState.applyPlayerConnectionState(player.playerId, {
      socketId: '',
    });

    const events = await this.buildImmediateEvents({
      roomId,
      player,
      playerName: displayName ?? player.name,
      room,
      roomGameState,
    });

    return {
      playerId: player.playerId,
      playerName: displayName ?? player.name,
      roomGameState,
      timeoutMode: this.resolveTimeoutMode(state.gamePhase),
      events,
    };
  }

  async buildTimeoutEvents(params: {
    roomId: string;
    playerId: string;
    playerName: string;
    timeoutMode: DisconnectTimeoutMode;
  }): Promise<GatewayEvent[]> {
    const { roomId, playerId, playerName, timeoutMode } = params;

    if (timeoutMode === 'remove-player') {
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      roomGameState.removePlayer(playerId);
      return [
        this.roomUpdateGatewayEffectsService.buildPlayersEvent({
          players: roomGameState.getTransportPlayers(),
          scope: 'room',
          roomId,
        }),
      ];
    }

    const room = await this.roomService.getRoom(roomId);
    if (room?.status !== RoomStatus.PLAYING) {
      return [];
    }

    const converted = await this.roomService.convertPlayerToCOM(
      roomId,
      playerId,
    );
    if (!converted) {
      return [];
    }

    const updatedRoom = await this.roomService.getRoom(roomId);
    const roomGameState = await this.roomService.getRoomGameState(roomId);

    const roomEvents = updatedRoom
      ? await this.roomUpdateGatewayEffectsService.buildRoomEvents({
          room: updatedRoom,
          statePlayers: roomGameState.getState().players,
          scope: 'room',
          roomId,
        })
      : [];

    return [
      {
        scope: 'room',
        roomId,
        event: 'player-converted-to-com',
        payload: {
          playerId,
          playerName,
          message: 'Player disconnected for too long - converted to COM',
        },
      },
      ...roomEvents,
      this.roomUpdateGatewayEffectsService.buildRoomsListEvent({
        rooms: await this.roomService.listRooms(),
        scope: 'all',
      }),
    ];
  }

  private async sanitizePlayers(
    roomId: string,
    rawPlayers: unknown,
    roomGameState: Awaited<ReturnType<IRoomService['getRoomGameState']>>,
  ): Promise<DomainPlayer[]> {
    const safePlayers = Array.isArray(rawPlayers)
      ? rawPlayers.filter((player): player is DomainPlayer => Boolean(player))
      : [];

    if (Array.isArray(rawPlayers) && safePlayers.length !== rawPlayers.length) {
      this.logger.warn(
        `Dropping malformed players from room ${roomId} during disconnect cleanup`,
      );
      roomGameState.getState().players = safePlayers;
      await roomGameState.saveState();
    }

    return safePlayers;
  }

  private findPlayerForDisconnect(
    socketId: string,
    roomGameState: Awaited<ReturnType<IRoomService['getRoomGameState']>>,
    room: Room | null,
    players: DomainPlayer[],
  ): DomainPlayer | null {
    const disconnectedSessionUser =
      roomGameState.findSessionUserBySocketId(socketId);
    if (disconnectedSessionUser) {
      return (
        players.find(
          (candidate) =>
            candidate.playerId === disconnectedSessionUser.playerId,
        ) ?? null
      );
    }

    const roomPlayer = room?.players.find(
      (candidate) => candidate.socketId === socketId,
    );
    if (!roomPlayer) {
      return null;
    }

    return (
      players.find((candidate) => candidate.playerId === roomPlayer.playerId) ??
      null
    );
  }

  private async buildImmediateEvents(params: {
    roomId: string;
    player: DomainPlayer;
    playerName: string;
    room: Room | null;
    roomGameState: Awaited<ReturnType<IRoomService['getRoomGameState']>>;
  }): Promise<GatewayEvent[]> {
    const { roomId, player, playerName, roomGameState } = params;
    let room = params.room;
    const events: GatewayEvent[] = [];

    if (room?.hostId === player.playerId) {
      const nextHost = room.players.find(
        (candidate) =>
          candidate.playerId !== player.playerId && !candidate.isCOM,
      );
      if (nextHost) {
        await this.roomService.updateRoom(roomId, {
          hostId: nextHost.playerId,
        });
        room = await this.roomService.getRoom(roomId);
        if (room) {
          events.push(
            ...(await this.roomUpdateGatewayEffectsService.buildRoomEvents({
              room,
              statePlayers: roomGameState.getState().players,
              scope: 'room',
              roomId,
            })),
          );
        }
        events.push(
          this.roomUpdateGatewayEffectsService.buildRoomsListEvent({
            rooms: await this.roomService.listRooms(),
            scope: 'all',
          }),
        );
      }
    }

    events.push(
      ...this.buildDisconnectRoomSyncEvents({
        roomId,
        player,
        playerName,
        room,
        roomGameState,
      }),
    );

    return events;
  }

  private buildDisconnectRoomSyncEvents(params: {
    roomId: string;
    player: DomainPlayer;
    playerName: string;
    room: Room | null;
    roomGameState: Awaited<ReturnType<IRoomService['getRoomGameState']>>;
  }): GatewayEvent[] {
    const { roomId, player, playerName, room, roomGameState } = params;

    return [
      {
        scope: 'room',
        roomId,
        event: 'player-left',
        payload: {
          playerId: player.playerId,
          roomId,
        },
      },
      {
        scope: 'room',
        roomId,
        event: 'player-disconnected',
        payload: {
          playerId: player.playerId,
          playerName,
          roomId,
        },
      },
      {
        ...this.roomUpdateGatewayEffectsService.buildPlayersEvent({
          players: roomGameState.getTransportPlayers(
            roomGameState.getState().players,
            room?.players,
          ),
          scope: 'room',
          roomId,
        }),
      },
    ];
  }

  private resolveTimeoutMode(gamePhase: GamePhase): DisconnectTimeoutMode {
    return gamePhase === 'play' || gamePhase === 'blow'
      ? 'convert-to-com'
      : 'remove-player';
  }
}
