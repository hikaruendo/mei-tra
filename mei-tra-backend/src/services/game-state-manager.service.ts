import { Logger } from '@nestjs/common';
import { IGameStateRepository } from '../repositories/interfaces/game-state.repository.interface';
import {
  GamePhase,
  GameState,
  PlayerConnectionMetadata,
} from '../types/game.types';
import { GamePhaseService } from './game-phase.service';

export class GameStateManager {
  constructor(
    private readonly repository: IGameStateRepository,
    private readonly logger: Logger,
    private readonly gamePhaseService: GamePhaseService,
  ) {}

  async updateState(
    roomId: string | null,
    currentState: GameState,
    newState: Partial<GameState>,
  ): Promise<GameState> {
    if (Object.prototype.hasOwnProperty.call(newState, 'gamePhase')) {
      this.gamePhaseService.assertTransition(
        currentState.gamePhase,
        newState.gamePhase ?? null,
      );
    }

    const nextState = {
      ...currentState,
      ...newState,
    };

    if (roomId) {
      try {
        await this.repository.update(roomId, newState);
      } catch {
        // Keep in-memory state even if persistence fails.
      }
    }

    return nextState;
  }

  async transitionPhase(
    roomId: string | null,
    currentState: GameState,
    nextPhase: GamePhase,
  ): Promise<GameState> {
    return this.updateState(roomId, currentState, { gamePhase: nextPhase });
  }

  async loadState(
    roomId: string,
    initialState: GameState,
  ): Promise<GameState | null> {
    try {
      const persistedState = await this.repository.findByRoomId(roomId);
      if (persistedState) {
        return persistedState;
      }

      await this.repository.create(roomId, initialState);
      return null;
    } catch {
      return null;
    }
  }

  async configureGameSettings(
    roomId: string | null,
    pointsToWin: number,
  ): Promise<void> {
    if (!roomId) {
      return;
    }

    try {
      await this.repository.update(roomId, { pointsToWin });
    } catch {
      // Silent fail
    }
  }

  async saveState(roomId: string | null, state: GameState): Promise<void> {
    if (!roomId) {
      return;
    }

    try {
      await this.repository.update(roomId, state);
    } catch {
      // Silent fail
    }
  }

  async persistPlayerConnectionUpdate(
    roomId: string | null,
    playerId: string,
    updates: Partial<PlayerConnectionMetadata>,
  ): Promise<void> {
    if (!roomId) {
      return;
    }

    try {
      await this.repository.updatePlayerConnection(roomId, playerId, updates);
    } catch (error) {
      this.logger.error('Failed to persist player connection update:', error);
    }
  }

  async persistCurrentPlayerIndex(
    roomId: string | null,
    currentPlayerIndex: number,
  ): Promise<void> {
    if (!roomId) {
      return;
    }

    try {
      await this.repository.updateCurrentPlayerIndex(
        roomId,
        currentPlayerIndex,
      );
    } catch (error) {
      this.logger.error('Failed to persist turn change:', error);
    }
  }

  persistRoundNumber(roomId: string | null, roundNumber: number): void {
    if (!roomId) {
      return;
    }

    this.repository
      .bulkUpdate(roomId, { round_number: roundNumber })
      .catch((error) => {
        this.logger.error('Failed to persist round number:', error);
      });
  }

  async resetState(roomId: string | null, state: GameState): Promise<void> {
    if (!roomId) {
      return;
    }

    try {
      await this.repository.delete(roomId);
      await this.repository.create(roomId, state);
    } catch (error) {
      this.logger.error('Failed to reset persisted state:', error);
    }
  }
}
