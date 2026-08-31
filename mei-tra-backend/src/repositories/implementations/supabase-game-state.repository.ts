import { Injectable, Logger } from '@nestjs/common';
import {
  asGeneratedSupabaseClient,
  SupabaseService,
} from '../../database/supabase.service';
import {
  toJson,
  toJsonObject,
  type JsonObject,
} from '../../database/json-value';
import { IGameStateRepository } from '../interfaces/game-state.repository.interface';
import {
  BlowState,
  GameState,
  DomainPlayer,
  PlayState,
  ScoreRecord,
} from '../../types/game.types';
import {
  PersistedPlayerGameplayState,
  PersistedPlayerStates,
  toPersistedPlayerStates,
  toRuntimePlayer,
} from '../../adapters/player-adapters';
import { Database } from '../../types/database.types';
import type { Database as GeneratedDatabase } from '../../types/database.generated.types';
import { RoomPlayer } from '../../types/room.types';
import { asSeatId } from '../../types/identity.types';
import type { SeatId } from '../../types/identity.types';
import { normalizeGameStateIdentity } from '../../adapters/game-state-identity';
import { RosterMembershipMutation } from '../../types/room-membership.types';
import {
  findUnknownPersistedSeatReferences,
  toPersistedBlowState,
  toPersistedPendingBrokenHandReveal,
  toPersistedPlayState,
} from '../../adapters/game-state-persistence';

type GameStateRow = Database['public']['Tables']['game_states']['Row'];
type PersistedGameStateRow = Omit<GameStateRow, 'state_data'> & {
  state_data: Record<string, unknown>;
};
type RoomPlayerRow = Database['public']['Tables']['room_players']['Row'];
type GeneratedFunctions = GeneratedDatabase['public']['Functions'];

interface LoadedRoomGameState {
  gameState: PersistedGameStateRow;
  roomPlayers: RoomPlayerRow[];
}

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
    return this.supabaseService.client;
  }

  private get generatedSupabase() {
    return asGeneratedSupabaseClient(this.supabaseService.client);
  }

  async create(roomId: string, gameState: GameState): Promise<GameState> {
    try {
      const canonicalGameState = normalizeGameStateIdentity(gameState);
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
          team_score_records: this.convertScoreRecordsForPersistence(
            canonicalGameState.teamScoreRecords,
          ),
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
      const { data: loadedState, error: loadError } =
        await this.generatedSupabase.rpc('load_room_game_state', {
          p_room_id: roomId,
        });

      if (!loadError) {
        if (!loadedState) {
          return null;
        }

        const payload = this.parseLoadedRoomGameState(loadedState);
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
      const args: GeneratedFunctions['atomic_update_game_state']['Args'] = {
        p_room_id: roomId,
        p_state_patch: this.buildStatePatch(gameState),
        p_scalar_patch: this.buildScalarPatch(gameState),
        ...(expectedVersion === undefined
          ? {}
          : { p_expected_version: expectedVersion }),
      };
      const { data, error } = await this.generatedSupabase.rpc(
        'atomic_update_game_state',
        args,
      );

      if (error) {
        throw new Error(`Failed to update game state: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const roomPlayers = await this.fetchRoomPlayers(roomId);
      return this.mapDatabaseToGameState(
        this.parseGameStateRow(data),
        roomPlayers,
      );
    } catch (error) {
      this.logger.error('Error updating game state:', error);
      throw error;
    }
  }

  async persistRoomRoster(
    roomId: string,
    roomPlayers: RoomPlayer[],
    gameState: GameState,
    hostSeatId?: SeatId,
    membershipMutation?: RosterMembershipMutation,
  ): Promise<GameState | null> {
    const canonicalGameState = normalizeGameStateIdentity(gameState);
    const playerStates = toPersistedPlayerStates(canonicalGameState.players);
    const persistedRoomPlayers = roomPlayers.map((player, seatIndex) => ({
      seatId: player.seatId,
      userId: player.userId ?? null,
      name: player.name,
      team: player.team,
      isReady: player.isReady,
      isCOM: player.isCOM ?? false,
      joinedAt: player.joinedAt.toISOString(),
      seatIndex,
    }));

    try {
      const args: GeneratedFunctions['persist_room_roster_atomic']['Args'] = {
        p_room_id: roomId,
        p_room_players: toJson(persistedRoomPlayers),
        p_player_states: toJson(playerStates),
        p_state_patch: this.buildStatePatch(canonicalGameState),
        p_scalar_patch: this.buildScalarPatch(canonicalGameState),
        ...(hostSeatId ? { p_host_id: hostSeatId } : {}),
        ...(canonicalGameState.version === undefined
          ? {}
          : { p_expected_version: canonicalGameState.version }),
        ...(membershipMutation
          ? { p_membership_mutation: toJson(membershipMutation) }
          : {}),
      };
      const { data, error } = await this.generatedSupabase.rpc(
        'persist_room_roster_atomic',
        args,
      );

      if (error) {
        throw new Error(`Failed to persist room roster: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const persisted = this.parsePersistedRosterResult(data);
      return this.mapDatabaseToGameState(
        persisted.gameState,
        persisted.roomPlayers,
      );
    } catch (error) {
      this.logger.error('Error persisting room roster:', error);
      throw error;
    }
  }

  private buildStatePatch(gameState: Partial<GameState>): JsonObject {
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

    return toJsonObject(patch);
  }

  private buildScalarPatch(gameState: Partial<GameState>): JsonObject {
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
    return toJsonObject(patch);
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

  async updateGamePhase(
    roomId: string,
    phase: GameState['gamePhase'],
  ): Promise<boolean> {
    try {
      return Boolean(await this.update(roomId, { gamePhase: phase }));
    } catch (error) {
      this.logger.error('Error updating game phase:', error);
      return false;
    }
  }

  async bulkUpdate(
    roomId: string,
    updates: Partial<
      Pick<
        GameState,
        'roundNumber' | 'currentSeatId' | 'gamePhase' | 'pointsToWin'
      >
    >,
  ): Promise<boolean> {
    try {
      return Boolean(await this.update(roomId, updates));
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

  private parseLoadedRoomGameState(data: unknown): LoadedRoomGameState {
    if (
      !this.isRecord(data) ||
      !this.isGameStateRow(data.gameState) ||
      !Array.isArray(data.roomPlayers) ||
      !data.roomPlayers.every((player) => this.isRoomPlayerRow(player))
    ) {
      throw new Error('load_room_game_state returned an invalid payload');
    }

    return {
      gameState: data.gameState,
      roomPlayers: data.roomPlayers,
    };
  }

  private parsePersistedRosterResult(data: unknown): LoadedRoomGameState {
    if (!this.isRecord(data)) {
      throw new Error('persist_room_roster_atomic returned an invalid payload');
    }

    const roomPlayers = data.roomPlayers ?? [];
    if (
      !this.isGameStateRow(data) ||
      !Array.isArray(roomPlayers) ||
      !roomPlayers.every((player) => this.isRoomPlayerRow(player))
    ) {
      throw new Error('persist_room_roster_atomic returned an invalid roster');
    }

    return { gameState: data, roomPlayers };
  }

  private parseGameStateRow(data: unknown): PersistedGameStateRow {
    if (!this.isGameStateRow(data)) {
      throw new Error('Game state RPC returned an invalid row');
    }
    return data;
  }

  private isGameStateRow(value: unknown): value is PersistedGameStateRow {
    return (
      this.isRecord(value) &&
      typeof value.id === 'string' &&
      typeof value.room_id === 'string' &&
      this.isRecord(value.state_data) &&
      (typeof value.current_seat_id === 'string' ||
        value.current_seat_id === null) &&
      (value.game_phase === 'deal' ||
        value.game_phase === 'blow' ||
        value.game_phase === 'play' ||
        value.game_phase === 'waiting' ||
        value.game_phase === null) &&
      typeof value.round_number === 'number' &&
      typeof value.points_to_win === 'number' &&
      this.isTeamScores(value.team_scores) &&
      this.isTeamScoreRecords(value.team_score_records) &&
      typeof value.version === 'number' &&
      typeof value.created_at === 'string' &&
      typeof value.updated_at === 'string'
    );
  }

  private isRoomPlayerRow(value: unknown): value is RoomPlayerRow {
    return (
      this.isRecord(value) &&
      typeof value.id === 'string' &&
      typeof value.room_id === 'string' &&
      typeof value.name === 'string' &&
      typeof value.team === 'number' &&
      typeof value.is_ready === 'boolean' &&
      typeof value.is_com === 'boolean' &&
      typeof value.joined_at === 'string' &&
      typeof value.seat_index === 'number' &&
      (typeof value.user_id === 'string' || value.user_id === null)
    );
  }

  private isTeamScores(value: unknown): value is GameStateRow['team_scores'] {
    return (
      this.isRecord(value) &&
      Object.values(value).every(
        (score) =>
          this.isRecord(score) &&
          typeof score.play === 'number' &&
          typeof score.total === 'number',
      )
    );
  }

  private isTeamScoreRecords(
    value: unknown,
  ): value is GameStateRow['team_score_records'] {
    return (
      this.isRecord(value) &&
      Object.values(value).every(
        (records) =>
          Array.isArray(records) &&
          records.every(
            (record) =>
              this.isRecord(record) &&
              typeof record.points === 'number' &&
              typeof record.timestamp === 'string' &&
              typeof record.reason === 'string',
          ),
      )
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private mapDatabaseToGameState(
    dbGameState: PersistedGameStateRow,
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
    const canonicalCurrentSeatId = dbGameState.current_seat_id;
    if (
      canonicalCurrentSeatId &&
      !players.some((player) => player.seatId === canonicalCurrentSeatId)
    ) {
      throw new Error(
        `Current seat ${canonicalCurrentSeatId} is outside room ${dbGameState.room_id}`,
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

    return normalizeGameStateIdentity({
      version: dbGameState.version,
      identitySchemaVersion: 2,
      players,
      currentSeatId: canonicalCurrentSeatId
        ? asSeatId(canonicalCurrentSeatId)
        : null,
      gamePhase: dbGameState.game_phase,
      deck: this.readDeck(stateData.deck),
      teamScores: dbGameState.team_scores as Record<
        0 | 1,
        { play: number; total: number }
      >,
      teamScoreRecords: this.convertTimestampRecords(
        dbGameState.team_score_records,
      ),
      blowState,
      playState: stateData.playState as PlayState | undefined,
      pendingBrokenHandReveal: (stateData.pendingBrokenHandReveal ??
        null) as GameState['pendingBrokenHandReveal'],
      agari: (stateData.agari ?? undefined) as GameState['agari'],
      roundNumber: dbGameState.round_number,
      pointsToWin: dbGameState.points_to_win,
    });
  }

  private readDeck(value: unknown): GameState['deck'] {
    if (
      !Array.isArray(value) ||
      !value.every((card) => typeof card === 'string')
    ) {
      return [];
    }
    return value;
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
      seatId: player.seatId,
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
