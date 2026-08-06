/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IGameStateRepository } from '../interfaces/game-state.repository.interface';
import {
  BlowState,
  GameState,
  DomainPlayer,
  PlayerConnectionMetadata,
  ScoreRecord,
} from '../../types/game.types';
import {
  PersistedPlayerGameplayState,
  PersistedPlayerStates,
  toPersistedPlayerStates,
  toRuntimePlayer,
} from '../../types/player-adapters';
import { Database } from '../../types/database.types';
import { RoomPlayer } from '../../types/room.types';

type GameStateRow = Database['public']['Tables']['game_states']['Row'];
type GameStateUpdate = Database['public']['Tables']['game_states']['Update'];
type RoomPlayerRow = Database['public']['Tables']['room_players']['Row'];

interface LoadedRoomGameState {
  gameState: GameStateRow;
  roomPlayers: RoomPlayerRow[];
}

interface RosterPlayerSnapshot {
  playerId: string;
  name: string;
  team: number;
  isCOM?: boolean;
}

@Injectable()
export class SupabaseGameStateRepository implements IGameStateRepository {
  private readonly logger = new Logger(SupabaseGameStateRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    // Return typed client, but cast for database operations due to strict typing issues
    return this.supabaseService.client as any;
  }

  async create(roomId: string, gameState: GameState): Promise<GameState> {
    try {
      const { data, error } = await this.supabase
        .from('game_states')
        .insert({
          room_id: roomId,
          state_data: {
            playerStates: toPersistedPlayerStates(gameState.players),
            deck: gameState.deck,
            agari: gameState.agari,
            blowState: gameState.blowState,
            playState: gameState.playState,
          },
          current_player_id: this.resolveCurrentPlayerId(gameState),
          game_phase: gameState.gamePhase,
          round_number: gameState.roundNumber,
          points_to_win: gameState.pointsToWin,
          team_scores: gameState.teamScores,
          team_score_records: gameState.teamScoreRecords,
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create game state:', error);
        throw new Error(`Failed to create game state: ${error.message}`);
      }

      return { ...gameState, version: data.version };
    } catch (error) {
      this.logger.error('Error creating game state:', error);
      throw error;
    }
  }

  async findByRoomId(roomId: string): Promise<GameState | null> {
    try {
      const { data: loadedState, error: loadError } = await this.supabase.rpc(
        'load_room_game_state',
        { p_room_id: roomId },
      );

      if (!loadError) {
        if (!loadedState) {
          return null;
        }

        const payload = loadedState as LoadedRoomGameState;
        return this.mapDatabaseToGameState(
          payload.gameState,
          payload.roomPlayers,
        );
      }

      throw new Error(`Failed to load room game state: ${loadError.message}`);
    } catch (error) {
      this.logger.error('Error finding game state by room ID:', error);
      throw error;
    }
  }

  async update(
    roomId: string,
    gameState: Partial<GameState>,
    expectedVersion?: number,
  ): Promise<GameState | null> {
    try {
      const { data, error } = await this.supabase.rpc(
        'atomic_update_game_state',
        {
          p_room_id: roomId,
          p_state_patch: this.buildStatePatch(gameState),
          p_scalar_patch: this.buildScalarPatch(gameState),
          p_expected_version: expectedVersion ?? null,
        },
      );

      if (error) {
        throw new Error(`Failed to update game state: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const roomPlayers = await this.fetchRoomPlayers(roomId);
      return this.mapDatabaseToGameState(data as GameStateRow, roomPlayers);
    } catch (error) {
      this.logger.error('Error updating game state:', error);
      throw error;
    }
  }

  async persistRoomRoster(
    roomId: string,
    roomPlayers: RoomPlayer[],
    gameState: GameState,
    hostId?: string,
  ): Promise<GameState | null> {
    const playerStates = toPersistedPlayerStates(gameState.players);
    const persistedRoomPlayers = roomPlayers.map((player, seatIndex) => ({
      playerId: player.playerId,
      userId: player.userId ?? null,
      name: player.name,
      team: player.team,
      isReady: player.isReady,
      isHost: player.isHost,
      isCOM: player.isCOM ?? false,
      joinedAt: player.joinedAt.toISOString(),
      seatIndex,
    }));

    try {
      const { data, error } = await this.supabase.rpc(
        'persist_room_roster_atomic',
        {
          p_room_id: roomId,
          p_room_players: persistedRoomPlayers,
          p_player_states: playerStates,
          p_host_id: hostId ?? null,
          p_expected_version: gameState.version ?? null,
        },
      );

      if (error) {
        throw new Error(`Failed to persist room roster: ${error.message}`);
      }

      return data
        ? this.mapDatabaseToGameState(data as GameStateRow, roomPlayers)
        : null;
    } catch (error) {
      this.logger.error('Error persisting room roster:', error);
      throw error;
    }
  }

  private buildStatePatch(
    gameState: Partial<GameState>,
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {};

    if (gameState.players) {
      patch.playerStates = toPersistedPlayerStates(gameState.players);
    }
    if (gameState.deck) patch.deck = gameState.deck;
    if (gameState.agari !== undefined) patch.agari = gameState.agari;
    if (gameState.blowState) patch.blowState = gameState.blowState;
    if (gameState.playState) patch.playState = gameState.playState;
    if (gameState.pendingBrokenHandReveal !== undefined) {
      patch.pendingBrokenHandReveal = gameState.pendingBrokenHandReveal;
    }

    return patch;
  }

  private buildScalarPatch(
    gameState: Partial<GameState>,
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {};

    if (gameState.currentPlayerId !== undefined) {
      patch.currentPlayerId = gameState.currentPlayerId;
    } else if (gameState.currentPlayerIndex !== undefined) {
      const currentPlayerId =
        gameState.players?.[gameState.currentPlayerIndex]?.playerId;
      if (currentPlayerId !== undefined) {
        patch.currentPlayerId = currentPlayerId;
      }
    }
    if (gameState.gamePhase !== undefined) {
      patch.gamePhase = gameState.gamePhase;
    }
    if (gameState.roundNumber !== undefined) {
      patch.roundNumber = gameState.roundNumber;
    }
    if (gameState.pointsToWin !== undefined) {
      patch.pointsToWin = gameState.pointsToWin;
    }
    if (gameState.teamScores) patch.teamScores = gameState.teamScores;
    if (gameState.teamScoreRecords) {
      patch.teamScoreRecords = this.convertScoreRecordsForPersistence(
        gameState.teamScoreRecords,
      );
    }
    return patch;
  }

  private convertScoreRecordsForPersistence(
    recordsByTeam: GameState['teamScoreRecords'],
  ): Record<
    string,
    Array<{ points: number; timestamp: string; reason: string }>
  > {
    return Object.fromEntries(
      Object.entries(recordsByTeam).map(([team, records]) => [
        team,
        records.map((record) => ({
          points: record.points,
          timestamp: record.timestamp.toISOString(),
          reason: record.reason,
        })),
      ]),
    );
  }

  private async fetchRoomPlayers(roomId: string): Promise<RoomPlayerRow[]> {
    const { data, error } = await this.supabase
      .from('room_players')
      .select('*')
      .eq('room_id', roomId)
      .order('seat_index', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch room players: ${error.message}`);
    }

    return (data ?? []) as RoomPlayerRow[];
  }

  async delete(roomId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('game_states')
        .delete()
        .eq('room_id', roomId);

      if (error) {
        throw new Error(`Failed to delete game state: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Error deleting game state:', error);
      throw error;
    }
  }

  async updatePlayers(
    roomId: string,
    players: DomainPlayer[],
  ): Promise<boolean> {
    try {
      return Boolean(await this.update(roomId, { players }));
    } catch (error) {
      this.logger.error('Error updating players:', error);
      return false;
    }
  }

  async updatePlayerConnection(
    roomId: string,
    playerId: string,
    updates: Partial<PlayerConnectionMetadata>,
  ): Promise<boolean> {
    void playerId;
    void updates;

    // Connection metadata now lives in room/session state. Keep the method for
    // incremental Phase 3 compatibility without mutating persisted game-state
    // snapshots.
    const { error } = await this.supabase
      .from('game_states')
      .select('id')
      .eq('room_id', roomId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false;
      }

      this.logger.error(
        'Failed to verify game state before connection sync',
        error,
      );
      return false;
    }

    return true;
  }

  async updateGamePhase(roomId: string, phase: string): Promise<boolean> {
    try {
      return Boolean(
        await this.update(roomId, {
          gamePhase:
            phase as Database['public']['Tables']['game_states']['Row']['game_phase'],
        }),
      );
    } catch (error) {
      this.logger.error('Error updating game phase:', error);
      return false;
    }
  }

  async bulkUpdate(
    roomId: string,
    updates: Partial<GameStateUpdate>,
  ): Promise<boolean> {
    try {
      const gameStateUpdates: Partial<GameState> = {};
      if (updates.round_number !== undefined) {
        gameStateUpdates.roundNumber = updates.round_number;
      }
      if (updates.current_player_id !== undefined) {
        gameStateUpdates.currentPlayerId = updates.current_player_id;
      }
      if (updates.game_phase !== undefined) {
        gameStateUpdates.gamePhase = updates.game_phase;
      }
      if (updates.points_to_win !== undefined) {
        gameStateUpdates.pointsToWin = updates.points_to_win;
      }

      return Boolean(await this.update(roomId, gameStateUpdates));
    } catch (error) {
      this.logger.error('Error bulk updating game state:', error);
      return false;
    }
  }

  async deleteExpiredGameStates(expiryTime: number): Promise<number> {
    try {
      const expiryDate = new Date(Date.now() - expiryTime);

      const { data, error } = await this.supabase
        .from('game_states')
        .delete()
        .lt('updated_at', expiryDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(
          `Failed to delete expired game states: ${error.message}`,
        );
      }

      return data?.length || 0;
    } catch (error) {
      this.logger.error('Error deleting expired game states:', error);
      throw error;
    }
  }

  private mapDatabaseToGameState(
    dbGameState: GameStateRow,
    roomPlayers?: Array<RoomPlayerRow | RoomPlayer>,
  ): GameState {
    const stateData = dbGameState.state_data || {};
    const playerStates =
      stateData.playerStates && typeof stateData.playerStates === 'object'
        ? (stateData.playerStates as PersistedPlayerStates)
        : {};
    const rosterPlayers = (roomPlayers ?? []).map((player) =>
      this.toRosterPlayerSnapshot(player),
    );
    const roomPlayersById = new Map(
      rosterPlayers.map((player) => [player.playerId, player]),
    );
    const rosterOrder = rosterPlayers.map((player) => player.playerId);
    const players = rosterOrder
      .map((playerId) => {
        const roomPlayer = roomPlayersById.get(playerId);
        const gameplay = playerStates[playerId] as
          | PersistedPlayerGameplayState
          | undefined;

        return toRuntimePlayer({
          playerId,
          name: roomPlayer?.name,
          team: roomPlayer?.team as 0 | 1 | undefined,
          isCOM: roomPlayer?.isCOM,
          hand: gameplay?.hand,
          isPasser: gameplay?.isPasser,
          hasBroken: gameplay?.hasBroken,
          hasRequiredBroken: gameplay?.hasRequiredBroken,
        });
      })
      .filter((player): player is DomainPlayer => Boolean(player));

    const persistedCurrentPlayerId =
      typeof dbGameState.current_player_id === 'string'
        ? dbGameState.current_player_id
        : null;
    const currentPlayerId =
      persistedCurrentPlayerId &&
      players.some((player) => player.playerId === persistedCurrentPlayerId)
        ? persistedCurrentPlayerId
        : null;
    const currentPlayerIndex =
      currentPlayerId === null
        ? 0
        : players.findIndex((player) => player.playerId === currentPlayerId);
    const blowState = this.reconcileBlowStateForRoster(
      (stateData.blowState ?? {
        currentTrump: null,
        currentHighestDeclaration: null,
        declarations: [],
        actionHistory: [],
        lastPasser: null,
        isRoundCancelled: false,
        currentBlowIndex: 0,
      }) as BlowState,
      players,
    );

    return {
      version: dbGameState.version,
      players,
      currentPlayerId,
      currentPlayerIndex: currentPlayerIndex === -1 ? 0 : currentPlayerIndex,
      gamePhase: dbGameState.game_phase,
      deck: stateData.deck || [],
      teamScores: dbGameState.team_scores as Record<
        0 | 1,
        { play: number; total: number }
      >,
      teamScoreRecords: this.convertTimestampRecords(
        dbGameState.team_score_records,
      ),
      blowState,
      playState: stateData.playState,
      pendingBrokenHandReveal: stateData.pendingBrokenHandReveal ?? null,
      agari: stateData.agari,
      roundNumber: dbGameState.round_number,
      pointsToWin: dbGameState.points_to_win,
      teamAssignments: Object.fromEntries(
        players.map((player) => [player.playerId, player.team]),
      ),
    };
  }

  private reconcileBlowStateForRoster(
    blowState: BlowState,
    players: DomainPlayer[],
  ): BlowState {
    if (players.length === 0) {
      return blowState;
    }

    const rosterPlayerIds = new Set(players.map((player) => player.playerId));
    const referencedPlayerIds = new Set<string>();

    blowState.declarations.forEach((declaration) => {
      referencedPlayerIds.add(declaration.playerId);
    });
    (blowState.actionHistory ?? []).forEach((action) => {
      referencedPlayerIds.add(action.playerId);
    });
    if (blowState.currentHighestDeclaration?.playerId) {
      referencedPlayerIds.add(blowState.currentHighestDeclaration.playerId);
    }
    if (blowState.lastPasser) {
      referencedPlayerIds.add(blowState.lastPasser);
    }

    const orphanPlayerIds = [...referencedPlayerIds].filter(
      (playerId) => !rosterPlayerIds.has(playerId),
    );
    if (orphanPlayerIds.length !== 1) {
      return blowState;
    }

    const actedRosterPlayerIds = new Set(
      [...referencedPlayerIds].filter((playerId) =>
        rosterPlayerIds.has(playerId),
      ),
    );
    const missingPlayers = players.filter(
      (player) => !actedRosterPlayerIds.has(player.playerId),
    );
    if (missingPlayers.length !== 1) {
      return blowState;
    }

    const fromPlayerId = orphanPlayerIds[0];
    const toPlayer = missingPlayers[0];
    const remappedBlowState: BlowState = {
      ...blowState,
      declarations: blowState.declarations.map((declaration) =>
        declaration.playerId === fromPlayerId
          ? {
              ...declaration,
              playerId: toPlayer.playerId,
              team: toPlayer.team,
            }
          : declaration,
      ),
      actionHistory: (blowState.actionHistory ?? []).map((action) =>
        action.playerId === fromPlayerId
          ? { ...action, playerId: toPlayer.playerId }
          : action,
      ),
      currentHighestDeclaration:
        blowState.currentHighestDeclaration?.playerId === fromPlayerId
          ? {
              ...blowState.currentHighestDeclaration,
              playerId: toPlayer.playerId,
              team: toPlayer.team,
            }
          : blowState.currentHighestDeclaration,
      lastPasser:
        blowState.lastPasser === fromPlayerId
          ? toPlayer.playerId
          : blowState.lastPasser,
    };

    if (
      remappedBlowState.lastPasser === toPlayer.playerId ||
      remappedBlowState.actionHistory.some(
        (action) =>
          action.type === 'pass' && action.playerId === toPlayer.playerId,
      )
    ) {
      toPlayer.isPasser = true;
    }

    return remappedBlowState;
  }

  private resolveCurrentPlayerId(gameState: GameState): string | null {
    if (gameState.currentPlayerId !== undefined) {
      return gameState.currentPlayerId;
    }

    return gameState.players[gameState.currentPlayerIndex]?.playerId ?? null;
  }

  private toRosterPlayerSnapshot(
    player: RoomPlayerRow | RoomPlayer,
  ): RosterPlayerSnapshot {
    if ('player_id' in player) {
      return {
        playerId: player.player_id,
        name: player.name,
        team: player.team,
        isCOM: player.is_com,
      };
    }

    return {
      playerId: player.playerId,
      name: player.name,
      team: player.team,
      isCOM: player.isCOM,
    };
  }

  private convertTimestampRecords(
    dbRecords: Record<
      string,
      Array<{ points: number; timestamp: string; reason: string }>
    >,
  ): Record<0 | 1, ScoreRecord[]> {
    const result: Record<0 | 1, ScoreRecord[]> = { 0: [], 1: [] };

    Object.entries(dbRecords || {}).forEach(([team, records]) => {
      const teamKey = parseInt(team) as 0 | 1;
      result[teamKey] = records.map((record) => ({
        points: record.points,
        timestamp: new Date(record.timestamp),
        reason: record.reason,
      }));
    });

    return result;
  }
}
