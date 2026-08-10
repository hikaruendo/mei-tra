import { Logger } from '@nestjs/common';
import { IGameStateRepository } from '../repositories/interfaces/game-state.repository.interface';
import {
  GamePhase,
  GameState,
  PlayerConnectionMetadata,
} from '../types/game.types';
import { RoomPlayer } from '../types/room.types';
import { RosterMembershipMutation } from '../types/room-membership.types';
import { GamePhaseService } from './game-phase.service';
import { asSeatId } from '../types/identity.types';
import { normalizeGameStateIdentityAliases } from '../types/game-state-identity';

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

    let nextState: GameState = {
      ...currentState,
      ...newState,
    };
    if (
      Object.prototype.hasOwnProperty.call(newState, 'currentPlayerId') &&
      !Object.prototype.hasOwnProperty.call(newState, 'currentSeatId')
    ) {
      nextState.currentSeatId = newState.currentPlayerId
        ? asSeatId(newState.currentPlayerId)
        : null;
    }
    nextState = normalizeGameStateIdentityAliases(nextState);

    if (roomId) {
      const persistencePatch: Partial<GameState> = { ...newState };
      if (
        Object.prototype.hasOwnProperty.call(newState, 'currentSeatId') ||
        Object.prototype.hasOwnProperty.call(newState, 'currentPlayerId') ||
        Object.prototype.hasOwnProperty.call(newState, 'currentPlayerIndex')
      ) {
        persistencePatch.currentSeatId = nextState.currentSeatId;
        persistencePatch.currentPlayerId = nextState.currentPlayerId;
      }
      if (newState.players) {
        persistencePatch.players = nextState.players;
      }
      if (newState.blowState) {
        persistencePatch.blowState = nextState.blowState;
      }
      if (newState.playState) {
        persistencePatch.playState = nextState.playState;
      }
      if (
        Object.prototype.hasOwnProperty.call(
          newState,
          'pendingBrokenHandReveal',
        )
      ) {
        persistencePatch.pendingBrokenHandReveal =
          nextState.pendingBrokenHandReveal;
      }
      const persistedState = await this.repository.update(
        roomId,
        persistencePatch,
        currentState.version,
      );
      if (!persistedState) {
        throw new Error(`Game state not found for room ${roomId}`);
      }
      nextState.version = persistedState.version;
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
    } catch (error) {
      this.logger.error(`Failed to load game state for room ${roomId}`, error);
      throw error;
    }
  }

  async configureGameSettings(
    roomId: string | null,
    currentState: GameState,
    pointsToWin: number,
  ): Promise<GameState> {
    if (!roomId) {
      return { ...currentState, pointsToWin };
    }

    const persistedState = await this.repository.update(
      roomId,
      { pointsToWin },
      currentState.version,
    );
    if (!persistedState) {
      throw new Error(`Game state not found for room ${roomId}`);
    }
    return persistedState;
  }

  async saveState(roomId: string | null, state: GameState): Promise<GameState> {
    const normalizedState = normalizeGameStateIdentityAliases(state);
    if (!roomId) {
      return normalizedState;
    }

    const persistedState = await this.repository.update(
      roomId,
      normalizedState,
      state.version,
    );
    if (!persistedState) {
      throw new Error(`Game state not found for room ${roomId}`);
    }
    return persistedState;
  }

  async persistRoster(
    roomId: string | null,
    roomPlayers: RoomPlayer[],
    state: GameState,
    hostId?: string,
    membershipMutation?: RosterMembershipMutation,
  ): Promise<GameState> {
    if (!roomId) {
      throw new Error('Cannot persist roster without a room ID');
    }

    const persistedState = await this.repository.persistRoomRoster(
      roomId,
      roomPlayers,
      state,
      hostId,
      membershipMutation,
    );

    if (!persistedState) {
      throw new Error(`Game state not found for room ${roomId}`);
    }
    return persistedState;
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

  async persistCurrentPlayerId(
    roomId: string | null,
    state: GameState,
    currentPlayerId: string | null,
  ): Promise<number | undefined> {
    if (!roomId) {
      return state.version;
    }

    const persistedState = await this.repository.update(
      roomId,
      { currentPlayerId },
      state.version,
    );
    if (!persistedState) {
      throw new Error(`Game state not found for room ${roomId}`);
    }
    return persistedState.version;
  }

  async persistRoundNumber(
    roomId: string | null,
    state: GameState,
    roundNumber: number,
  ): Promise<number | undefined> {
    if (!roomId) {
      return state.version;
    }

    const persistedState = await this.repository.update(
      roomId,
      { roundNumber },
      state.version,
    );
    if (!persistedState) {
      throw new Error(`Game state not found for room ${roomId}`);
    }
    return persistedState.version;
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
