import { Inject, Injectable, Logger } from '@nestjs/common';
import type { GameStatePayload } from '@contracts/game';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { toDomainPlayer } from '../types/player-adapters';
import { Room, RoomStatus } from '../types/room.types';
import {
  IWatchRoomUseCase,
  WatchRoomRequest,
  WatchRoomResponse,
} from './interfaces/watch-room.use-case.interface';
import { resolveTransportPlayers } from './helpers/player-resolution.helper';

@Injectable()
export class WatchRoomUseCase implements IWatchRoomUseCase {
  private readonly logger = new Logger(WatchRoomUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: WatchRoomRequest): Promise<WatchRoomResponse> {
    try {
      const room = await this.roomService.getRoom(request.roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      if (!room.settings.allowSpectators) {
        return { success: false, error: 'Spectators are not allowed' };
      }

      const gameState = await this.buildSnapshotForRoom(room);
      if (!gameState) {
        return { success: false, error: 'Game is not active' };
      }

      return {
        success: true,
        data: {
          room,
          gameState,
        },
      };
    } catch (error) {
      this.logger.error(
        'Unexpected error while executing WatchRoomUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }

  async buildSnapshot(roomId: string): Promise<GameStatePayload | null> {
    const room = await this.roomService.getRoom(roomId);
    return room ? this.buildSnapshotForRoom(room) : null;
  }

  private async buildSnapshotForRoom(
    room: Room,
  ): Promise<GameStatePayload | null> {
    const roomGameState = await this.roomService.getRoomGameState(room.id);
    const state = roomGameState.getState();
    const isActive =
      room.status === RoomStatus.PLAYING || state.gamePhase !== null;

    if (!isActive) {
      return null;
    }

    const statePlayers =
      state.players.length > 0
        ? state.players
        : room.players.map((player) => toDomainPlayer(player));
    const currentTurn =
      state.currentPlayerIndex !== -1 && state.players[state.currentPlayerIndex]
        ? state.players[state.currentPlayerIndex].playerId
        : null;
    const spectatorPlayers = resolveTransportPlayers(
      roomGameState,
      statePlayers,
      {
        roomPlayers: room.players,
      },
    );

    return {
      players: spectatorPlayers,
      gamePhase: state.gamePhase ?? 'waiting',
      currentField: state.playState?.currentField ?? null,
      currentTurn,
      blowState: state.blowState,
      teamScores: state.teamScores,
      you: null,
      isSpectator: true,
      negriCard: state.playState?.negriCard ?? null,
      fields: state.playState?.fields ?? [],
      roomId: room.id,
      hostId: room.hostId,
      pointsToWin: room.settings.pointsToWin,
    };
  }
}
