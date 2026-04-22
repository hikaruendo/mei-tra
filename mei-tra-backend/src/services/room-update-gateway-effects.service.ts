import { Inject, Injectable } from '@nestjs/common';
import type { RoomContract, RoomSyncPayload } from '@contracts/room';
import { GatewayEvent } from '../use-cases/interfaces/gateway-event.interface';
import { resolveRoomTransportPlayers } from '../use-cases/helpers/player-resolution.helper';
import { DomainPlayer } from '../types/game.types';
import { Room } from '../types/room.types';
import { TransportPlayer } from '../types/player-adapters';
import { toRoomContract, toRoomContracts } from '../types/room-adapters';
import { IRoomService } from './interfaces/room-service.interface';

interface RoomUpdateGatewayView {
  room: RoomContract;
  players: TransportPlayer[];
}

interface BuildRoomsListEventParams {
  rooms: Room[];
  scope: 'all' | 'socket';
  socketId?: string;
}

interface BuildRoomEventsParams {
  room: Room;
  statePlayers?: DomainPlayer[];
  scope: 'room' | 'socket';
  roomId?: string;
  socketId?: string;
}

interface BuildPlayersEventParams {
  players: TransportPlayer[];
  scope: 'room' | 'socket';
  roomId?: string;
  socketId?: string;
}

@Injectable()
export class RoomUpdateGatewayEffectsService {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async buildRoomView(
    room: Room,
    options?: { statePlayers?: DomainPlayer[] },
  ): Promise<RoomUpdateGatewayView> {
    const roomGameState = await this.roomService.getRoomGameState(room.id);
    const statePlayers =
      options?.statePlayers ?? roomGameState.getState().players;
    const players = resolveRoomTransportPlayers(roomGameState, room, {
      statePlayers,
    });

    return {
      players,
      room: toRoomContract(room, { players }),
    };
  }

  buildRoomsListView(rooms: Room[]): RoomContract[] {
    return toRoomContracts(rooms);
  }

  buildRoomsListEvent({
    rooms,
    scope,
    socketId,
  }: BuildRoomsListEventParams): GatewayEvent {
    return {
      scope,
      socketId,
      event: 'rooms-list',
      payload: this.buildRoomsListView(rooms),
    };
  }

  buildRoomSyncEvent(params: {
    roomView: RoomUpdateGatewayView;
    scope: 'room' | 'socket';
    roomId?: string;
    socketId?: string;
  }): GatewayEvent {
    const { roomView, scope, roomId, socketId } = params;
    const payload: RoomSyncPayload = {
      room: roomView.room,
      players: roomView.players,
    };

    return {
      scope,
      roomId: scope === 'room' ? (roomId ?? roomView.room.id) : undefined,
      socketId: scope === 'socket' ? socketId : undefined,
      event: 'room-sync',
      payload,
    };
  }

  buildPlayersEvent({
    players,
    scope,
    roomId,
    socketId,
  }: BuildPlayersEventParams): GatewayEvent {
    return {
      scope,
      roomId,
      socketId,
      event: 'update-players',
      payload: players,
    };
  }

  async buildRoomEvents({
    room,
    statePlayers,
    scope,
    roomId,
    socketId,
  }: BuildRoomEventsParams): Promise<GatewayEvent[]> {
    const roomView = await this.buildRoomView(room, { statePlayers });
    const roomSyncEvent = this.buildRoomSyncEvent({
      roomView,
      scope,
      roomId,
      socketId,
    });

    if (scope === 'room') {
      return [
        roomSyncEvent,
        {
          scope: 'room',
          roomId: roomId ?? room.id,
          event: 'room-updated',
          payload: roomView.room,
        },
        {
          ...this.buildPlayersEvent({
            players: roomView.players,
            scope: 'room',
            roomId: roomId ?? room.id,
          }),
        },
      ];
    }

    return [
      roomSyncEvent,
      {
        scope: 'socket',
        socketId,
        event: 'room-updated',
        payload: roomView.room,
      },
      {
        ...this.buildPlayersEvent({
          players: roomView.players,
          scope: 'socket',
          socketId,
        }),
      },
    ];
  }
}
