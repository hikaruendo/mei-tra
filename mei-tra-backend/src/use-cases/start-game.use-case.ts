import { Injectable, Logger, Inject } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import {
  IStartGameUseCase,
  StartGameRequest,
  StartGameResponse,
} from './interfaces/start-game.use-case.interface';
import { RoomStatus } from '../types/room.types';

@Injectable()
export class StartGameUseCase implements IStartGameUseCase {
  private readonly logger = new Logger(StartGameUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: StartGameRequest): Promise<StartGameResponse> {
    try {
      const { roomId, clientId } = request;

      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return {
          success: false,
          errorMessage: 'Room not found',
        };
      }

      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();

      const player = state.players.find((p) => p.id === clientId);
      if (!player) {
        this.logger.error('Player not found in game state for game start', {
          clientId,
          roomId,
        });
        return {
          success: false,
          errorMessage:
            'Player not found in game state. Please rejoin the room.',
        };
      }

      const { canStart, reason } = await this.roomService.canStartGame(roomId);
      if (!canStart) {
        return {
          success: false,
          errorMessage: reason || 'Cannot start game',
        };
      }

      await this.roomService.updateRoomStatus(roomId, RoomStatus.PLAYING);
      await roomGameState.startGame();

      const updatedState = roomGameState.getState();
      updatedState.pointsToWin = room.settings.pointsToWin;

      // Synchronize hands with room representation
      room.players.forEach((roomPlayer) => {
        const statePlayer = updatedState.players.find(
          (p) => p.playerId === roomPlayer.playerId,
        );
        if (statePlayer) {
          roomPlayer.hand = [...statePlayer.hand];
        }
      });

      // Reset all players' isPasser flag at blow phase start
      updatedState.players.forEach((p) => {
        p.isPasser = false;
      });

      const firstBlowIndex = 0;
      const firstBlowPlayer = updatedState.players[firstBlowIndex];

      updatedState.currentPlayerIndex = firstBlowIndex;
      updatedState.blowState = {
        ...updatedState.blowState,
        currentBlowIndex: firstBlowIndex,
      };

      return {
        success: true,
        data: {
          players: updatedState.players,
          pointsToWin: updatedState.pointsToWin,
          updatePhase: {
            phase: updatedState.gamePhase,
            scores: updatedState.teamScores,
            winner: null,
          },
          currentTurnPlayerId: firstBlowPlayer.playerId,
        },
      };
    } catch (error) {
      this.logger.error(
        'Unexpected error while executing StartGameUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        success: false,
        errorMessage: 'Failed to start game',
      };
    }
  }
}
