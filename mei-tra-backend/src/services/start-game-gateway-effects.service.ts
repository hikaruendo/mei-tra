import { Inject, Injectable } from '@nestjs/common';
import type { GameStartedPayload, UpdatePhasePayload } from '@contracts/game';
import { GatewayEvent } from '../use-cases/interfaces/gateway-event.interface';
import { DomainPlayer } from '../types/game.types';
import type { SeatId } from '../types/identity.types';
import { IRoomService } from './interfaces/room-service.interface';
import { RoomUpdateGatewayEffectsService } from './room-update-gateway-effects.service';

interface BuildStartGameEventsParams {
  roomId: string;
  players: DomainPlayer[];
  pointsToWin: number;
  updatePhase: UpdatePhasePayload;
  currentTurnSeatId: SeatId;
}

@Injectable()
export class StartGameGatewayEffectsService {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    private readonly roomUpdateGatewayEffectsService: RoomUpdateGatewayEffectsService,
  ) {}

  async buildEvents({
    roomId,
    players,
    pointsToWin,
    updatePhase,
    currentTurnSeatId,
  }: BuildStartGameEventsParams): Promise<GatewayEvent[]> {
    const room = await this.roomService.getRoom(roomId);
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const transportPlayers = roomGameState.getTransportPlayers(
      players,
      room?.players,
    );

    const gameStartedPayload: GameStartedPayload = {
      roomId,
      players: transportPlayers,
      pointsToWin,
      teamNames: room?.settings.teamNames,
    };
    const roomEvents = room
      ? await this.roomUpdateGatewayEffectsService.buildRoomEvents({
          room,
          statePlayers: players,
          scope: 'room',
          roomId,
        })
      : [];
    const roomsList = await this.roomService.listRooms();

    return [
      ...roomEvents,
      this.roomUpdateGatewayEffectsService.buildRoomsListEvent({
        rooms: roomsList,
        scope: 'all',
      }),
      {
        scope: 'room',
        roomId,
        event: 'game-started',
        payload: gameStartedPayload,
      },
      {
        scope: 'room',
        roomId,
        event: 'update-phase',
        payload: updatePhase,
      },
      {
        scope: 'room',
        roomId,
        event: 'update-turn',
        payload: currentTurnSeatId,
      },
    ];
  }
}
