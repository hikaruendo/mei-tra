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

      // ゲームステートにプレイヤーが不足している場合（サーバー再起動後など）、
      // ルームのプレイヤー情報で補完する
      const missingPlayers = room.players.filter(
        (rp) => !state.players.some((sp) => sp.playerId === rp.playerId),
      );
      for (const mp of missingPlayers) {
        state.players.push(mp);
        roomGameState.registerPlayerToken(mp.playerId, mp.playerId);
      }

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

      // Sync team assignments from DB (source of truth) to in-memory state.players.
      // changePlayerTeamUseCase only persists to DB, so state.players may have stale teams.
      state.players.forEach((sp) => {
        const roomPlayer = room.players.find(
          (rp) => rp.playerId === sp.playerId,
        );
        if (roomPlayer) {
          sp.team = roomPlayer.team;
        }
      });

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
