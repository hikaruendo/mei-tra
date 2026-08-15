import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import {
  IStartGameUseCase,
  StartGameRequest,
  StartGameResponse,
} from './interfaces/start-game.use-case.interface';
import { Room, RoomStatus } from '../types/room.types';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { toDomainPlayer } from '../types/player-adapters';
import { GameStateService } from '../services/game-state.service';
import { GameState } from '../types/game.types';
import { asSeatId } from '../types/identity.types';
import {
  resolveCurrentPlayer,
  resolveCurrentPlayerIndex,
} from '../types/current-turn';

@Injectable()
export class StartGameUseCase implements IStartGameUseCase {
  private readonly logger = new Logger(StartGameUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
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
      const player = room.players.find((p) => p.seatId === playerId);
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
      if (room.hostSeatId !== playerId) {
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
      const roomWithFilledSeats = await this.roomService.getRoom(roomId);
      if (!roomWithFilledSeats) {
        return {
          success: false,
          errorMessage: 'Room not found after filling vacant seats',
        };
      }

      const teamValidationError =
        this.validateFullRoomTeamBalance(roomWithFilledSeats);
      if (teamValidationError) {
        return {
          success: false,
          errorMessage: teamValidationError,
        };
      }

      roomWithFilledSeats.players = this.arrangeRoomPlayersForSeatOrder(
        roomWithFilledSeats.players,
      );
      this.syncStatePlayersFromRoom(roomGameState, roomWithFilledSeats);
      await roomGameState.persistRoster(
        roomWithFilledSeats.players,
        roomWithFilledSeats.hostSeatId,
      );

      const statusUpdated = await this.roomService.updateRoomStatus(
        roomId,
        RoomStatus.PLAYING,
      );
      if (!statusUpdated) {
        return {
          success: false,
          errorMessage: 'Failed to mark room as playing',
        };
      }
      roomGameState.startGame();

      let updatedState = roomGameState.getState();
      const currentPlayerIndex = resolveCurrentPlayerIndex(updatedState);
      if (currentPlayerIndex === -1) {
        return {
          success: false,
          errorMessage: 'Current turn seat was not initialized',
        };
      }
      if (updatedState.blowState.currentBlowIndex !== currentPlayerIndex) {
        const currentPlayer = resolveCurrentPlayer(updatedState);
        roomGameState.updateState({
          currentSeatId: currentPlayer ? asSeatId(currentPlayer.seatId) : null,
          blowState: {
            ...updatedState.blowState,
            currentBlowIndex: currentPlayerIndex,
          },
        });
        updatedState = roomGameState.getState();
      }
      updatedState.pointsToWin = room.settings.pointsToWin;

      // Reset all players' isPasser flag at blow phase start
      updatedState.players.forEach((p) => {
        p.isPasser = false;
      });

      const currentTurnPlayer = resolveCurrentPlayer(updatedState);
      if (!currentTurnPlayer) {
        return {
          success: false,
          errorMessage: 'Current turn seat was not initialized',
        };
      }
      const firstBlowPlayer =
        updatedState.players[updatedState.blowState.currentBlowIndex];

      await roomGameState.saveState();

      await this.gameEventLogService?.log({
        roomId,
        actionType: 'game_started',
        actorSeatId: asSeatId(playerId),
        state: updatedState,
        actionData: {
          startedBySeatId: playerId,
          firstBlowSeatId: firstBlowPlayer?.seatId ?? null,
          pointsToWin: updatedState.pointsToWin,
          playerCount: updatedState.players.length,
          startingHandsBySeatId: Object.fromEntries(
            updatedState.players.map((player) => [
              player.seatId,
              [...player.hand],
            ]),
          ),
        },
      });

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
          currentTurnSeatId: asSeatId(currentTurnPlayer.seatId),
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

  private syncStatePlayersFromRoom(
    roomGameState: GameStateService,
    room: Room,
  ): GameState {
    const state = roomGameState.getState();

    // Waiting-room seat order is driven by room.players, so rebuild the in-memory
    // players array from that source before starting. This keeps the play order
    // aligned with the shuffled seat arrangement instead of any stale game-state order.
    const existingPlayers = new Map(
      state.players.map((statePlayer) => [statePlayer.seatId, statePlayer]),
    );
    state.players = room.players.map((roomPlayer) => {
      const existingPlayer = existingPlayers.get(roomPlayer.seatId);

      if (!existingPlayer) {
        if (typeof roomGameState.registerPlayerToken === 'function') {
          roomGameState.registerPlayerToken(
            roomPlayer.seatId,
            roomPlayer.seatId,
          );
        }
        return {
          ...toDomainPlayer(roomPlayer),
        };
      }

      return {
        ...toDomainPlayer(existingPlayer),
        ...toDomainPlayer(roomPlayer),
        hand: [...existingPlayer.hand],
        isPasser: existingPlayer.isPasser,
        hasBroken: existingPlayer.hasBroken,
        hasRequiredBroken: existingPlayer.hasRequiredBroken,
      };
    });

    state.teamAssignments = Object.fromEntries(
      state.players.map((player) => [player.seatId, player.team]),
    );

    return state;
  }

  private arrangeRoomPlayersForSeatOrder(
    players: Room['players'],
  ): Room['players'] {
    const team0Players = players.filter((player) => player.team === 0);
    const team1Players = players.filter((player) => player.team === 1);

    if (team0Players.length === 0 || team1Players.length === 0) {
      return players.map((player, seatIndex) => ({ ...player, seatIndex }));
    }

    const orderedPlayers: Room['players'] = [];
    const maxTeamSize = Math.max(team0Players.length, team1Players.length);

    for (let teamIndex = 0; teamIndex < maxTeamSize; teamIndex += 1) {
      const team0Player = team0Players[teamIndex];
      const team1Player = team1Players[teamIndex];
      if (team0Player) {
        orderedPlayers.push(team0Player);
      }
      if (team1Player) {
        orderedPlayers.push(team1Player);
      }
    }

    if (orderedPlayers.length !== players.length) {
      throw new Error('Failed to arrange the complete room roster');
    }

    return orderedPlayers.map((player, seatIndex) => ({
      ...player,
      seatIndex,
    }));
  }

  private validateFullRoomTeamBalance(room: Room): string | null {
    const maxPlayers = room.settings.maxPlayers;
    if (room.players.length !== maxPlayers) {
      return null;
    }

    const team0Count = room.players.filter(
      (player) => player.team === 0,
    ).length;
    const team1Count = room.players.filter(
      (player) => player.team === 1,
    ).length;
    const expectedTeamSize = maxPlayers / 2;

    if (team0Count !== expectedTeamSize || team1Count !== expectedTeamSize) {
      return 'Teams must be balanced before starting the game';
    }

    return null;
  }
}
