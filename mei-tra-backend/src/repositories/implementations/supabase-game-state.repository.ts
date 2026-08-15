/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IGameStateRepository } from '../interfaces/game-state.repository.interface';
import {
  BlowState,
  GameState,
  DomainPlayer,
  PlayerConnectionMetadata,
  PlayState,
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
import { asSeatId, resolveSeatId } from '../../types/identity.types';
import { normalizeGameStateIdentityAliases } from '../../types/game-state-identity';
import { RosterMembershipMutation } from '../../types/room-membership.types';
import {
  findUnknownPersistedSeatReferences,
  toPersistedBlowState,
  toPersistedPendingBrokenHandReveal,
  toPersistedPlayState,
} from '../../types/game-state-persistence';

type GameStateRow = Database['public']['Tables']['game_states']['Row'];
type GameStateUpdate = Database['public']['Tables']['game_states']['Update'];
type RoomPlayerRow = Database['public']['Tables']['room_players']['Row'];

interface LoadedRoomGameState {
  gameState: GameStateRow;
  roomPlayers: RoomPlayerRow[];
}

type PersistedRosterResult = GameStateRow & {
  roomPlayers?: RoomPlayerRow[];
};

interface RosterPlayerSnapshot {
  seatId: string;
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
      const canonicalGameState = normalizeGameStateIdentityAliases(gameState);
      const { data, error } = await this.supabase
        .from('game_states')
        .insert({
          room_id: roomId,
          state_data: {
            identitySchemaVersion: 2,
            playerStates: toPersistedPlayerStates(canonicalGameState.players),
            deck: canonicalGameState.deck,
            agari: canonicalGameState.agari,
            blowState: toPersistedBlowState(canonicalGameState.blowState),
            playState: toPersistedPlayState(canonicalGameState.playState),
            pendingBrokenHandReveal: toPersistedPendingBrokenHandReveal(
              canonicalGameState.pendingBrokenHandReveal,
            ),
          },
          current_seat_id: canonicalGameState.currentSeatId,
          game_phase: canonicalGameState.gamePhase,
          round_number: canonicalGameState.roundNumber,
          points_to_win: canonicalGameState.pointsToWin,
          team_scores: canonicalGameState.teamScores,
          team_score_records: canonicalGameState.teamScoreRecords,
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create game state:', error);
        throw new Error(`Failed to create game state: ${error.message}`);
      }

      return { ...canonicalGameState, version: data.version };
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
    membershipMutation?: RosterMembershipMutation,
  ): Promise<GameState | null> {
    const canonicalGameState = normalizeGameStateIdentityAliases(gameState);
    const playerStates = toPersistedPlayerStates(canonicalGameState.players);
    const persistedRoomPlayers = roomPlayers.map((player, seatIndex) => ({
      seatId: resolveSeatId(player),
      userId: player.userId ?? null,
      name: player.name,
      team: player.team,
      isReady: player.isReady,
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
          p_state_patch: this.buildStatePatch(canonicalGameState),
          p_scalar_patch: this.buildScalarPatch(canonicalGameState),
          p_host_id: hostId ?? null,
          p_expected_version: canonicalGameState.version ?? null,
          p_membership_mutation: membershipMutation ?? null,
        },
      );

      if (error) {
        throw new Error(`Failed to persist room roster: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const persisted = data as PersistedRosterResult;
      const persistedRoomRoster = persisted.roomPlayers ?? [];
      return this.mapDatabaseToGameState(persisted, persistedRoomRoster);
    } catch (error) {
      this.logger.error('Error persisting room roster:', error);
      throw error;
    }
  }

  private buildStatePatch(
    gameState: Partial<GameState>,
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {};

    patch.identitySchemaVersion = 2;

    if (gameState.players) {
      patch.playerStates = toPersistedPlayerStates(gameState.players);
    }
    if (gameState.deck) patch.deck = gameState.deck;
    if (gameState.agari !== undefined) patch.agari = gameState.agari;
    if (gameState.blowState) {
      patch.blowState = toPersistedBlowState(gameState.blowState);
    }
    if (gameState.playState) {
      patch.playState = toPersistedPlayState(gameState.playState);
    }
    if (gameState.pendingBrokenHandReveal !== undefined) {
      patch.pendingBrokenHandReveal = toPersistedPendingBrokenHandReveal(
        gameState.pendingBrokenHandReveal,
      );
    }

    return patch;
  }

  private buildScalarPatch(
    gameState: Partial<GameState>,
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {};

    if (gameState.currentSeatId !== undefined) {
      patch.currentSeatId = gameState.currentSeatId;
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
      if (updates.current_seat_id !== undefined) {
        gameStateUpdates.currentSeatId = updates.current_seat_id
          ? asSeatId(updates.current_seat_id)
          : null;
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
    if (stateData.identitySchemaVersion !== 2) {
      throw new Error(
        `Unsupported game-state identity schema for room ${dbGameState.room_id}`,
      );
    }
    const playerStates =
      stateData.playerStates && typeof stateData.playerStates === 'object'
        ? (stateData.playerStates as PersistedPlayerStates)
        : {};
    const rosterPlayers = (roomPlayers ?? []).map((player) =>
      this.toRosterPlayerSnapshot(player),
    );
    const roomPlayersById = new Map(
      rosterPlayers.map((player) => [player.seatId, player]),
    );
    const unknownStateSeats = findUnknownPersistedSeatReferences(
      stateData,
      new Set(roomPlayersById.keys()),
    );
    if (unknownStateSeats.length > 0) {
      throw new Error(
        `Game state references seats outside room ${dbGameState.room_id}: ${unknownStateSeats.join(',')}`,
      );
    }
    const rosterOrder = rosterPlayers.map((player) => player.seatId);
    const players = rosterOrder
      .map((seatId) => {
        const roomPlayer = roomPlayersById.get(seatId);
        const gameplay = playerStates[seatId] as
          | PersistedPlayerGameplayState
          | undefined;

        return toRuntimePlayer({
          seatId: asSeatId(seatId),
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
    const canonicalCurrentPlayerId = dbGameState.current_seat_id;
    if (
      canonicalCurrentPlayerId &&
      !players.some((player) => player.seatId === canonicalCurrentPlayerId)
    ) {
      throw new Error(
        `Current seat ${canonicalCurrentPlayerId} is outside room ${dbGameState.room_id}`,
      );
    }
    const blowState = (stateData.blowState ?? {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      actionHistory: [],
      lastPasserSeatId: null,
      isRoundCancelled: false,
      currentBlowIndex: 0,
    }) as BlowState;

    return normalizeGameStateIdentityAliases({
      version: dbGameState.version,
      identitySchemaVersion: 2,
      players,
      currentSeatId: canonicalCurrentPlayerId
        ? asSeatId(canonicalCurrentPlayerId)
        : null,
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
      playState: stateData.playState as PlayState | undefined,
      pendingBrokenHandReveal: stateData.pendingBrokenHandReveal ?? null,
      agari: stateData.agari ?? undefined,
      roundNumber: dbGameState.round_number,
      pointsToWin: dbGameState.points_to_win,
      teamAssignments: Object.fromEntries(
        players.map((player) => [player.seatId, player.team]),
      ),
    });
  }

  private toRosterPlayerSnapshot(
    player: RoomPlayerRow | RoomPlayer,
  ): RosterPlayerSnapshot {
    if ('room_id' in player) {
      const seatId = player.id;
      return {
        seatId,
        name: player.name,
        team: player.team,
        isCOM: player.is_com,
      };
    }

    return {
      seatId: resolveSeatId(player),
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
