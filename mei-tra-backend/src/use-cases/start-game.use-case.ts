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
      const { roomId, playerId } = request;

      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return {
          success: false,
          errorMessage: 'Room not found',
        };
      }

      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();

      // Waiting-room seat order is driven by room.players, so rebuild the in-memory
      // players array from that source before starting. This keeps the play order
      // aligned with the shuffled seat arrangement instead of any stale game-state order.
      const existingPlayers = new Map(
        state.players.map((statePlayer) => [statePlayer.playerId, statePlayer]),
      );
      state.players = room.players.map((roomPlayer) => {
        const existingPlayer = existingPlayers.get(roomPlayer.playerId);

        if (!existingPlayer) {
          if (typeof roomGameState.registerPlayerToken === 'function') {
            roomGameState.registerPlayerToken(
              roomPlayer.playerId,
              roomPlayer.playerId,
            );
          }
          return {
            ...roomPlayer,
            hand: [...roomPlayer.hand],
            isPasser: roomPlayer.isPasser ?? false,
            hasBroken: roomPlayer.hasBroken ?? false,
            hasRequiredBroken: roomPlayer.hasRequiredBroken ?? false,
          };
        }

        return {
          ...existingPlayer,
          ...roomPlayer,
          hand: [...existingPlayer.hand],
          isPasser: existingPlayer.isPasser,
          hasBroken: existingPlayer.hasBroken,
          hasRequiredBroken: existingPlayer.hasRequiredBroken,
        };
      });

      state.teamAssignments = Object.fromEntries(
        state.players.map((player) => [player.playerId, player.team]),
      );

      const player = state.players.find((p) => p.playerId === playerId);
      if (!player) {
        this.logger.error('Player not found in game state for game start', {
          playerId,
          roomId,
        });
        return {
          success: false,
          errorMessage:
            'Player not found in game state. Please rejoin the room.',
        };
      }

      // Authorization check: verify the requesting player is the host
      if (room.hostId !== playerId) {
        return {
          success: false,
          errorMessage: 'Only the host can start the game',
        };
      }

      const { canStart, reason } = await this.roomService.canStartGame(roomId);
      if (!canStart) {
        return {
          success: false,
          errorMessage: reason || 'Cannot start game',
        };
      }

      // 空席をCOMで埋めてからゲーム開始
      await this.roomService.fillVacantSeatsWithCOM(roomId);

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

      // firstBlowIndex is randomized inside roomGameState.startGame()
      const firstBlowPlayer =
        updatedState.players[updatedState.blowState.currentBlowIndex];

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
