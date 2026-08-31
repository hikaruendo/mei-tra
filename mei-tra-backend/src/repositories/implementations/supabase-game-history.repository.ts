import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { toJsonObject } from '../../database/json-value';
import { IGameHistoryRepository } from '../interfaces/game-history.repository.interface';
import {
  CreateGameHistoryEntry,
  GameHistoryActionType,
  GameHistoryEntry,
  GameHistoryQuery,
} from '../../types/game-history.types';
import type { Database } from '../../types/database.generated.types';
import { asSeatId } from '../../types/identity.types';

type GameHistoryRow = Database['public']['Tables']['game_history']['Row'];

@Injectable()
export class SupabaseGameHistoryRepository implements IGameHistoryRepository {
  private readonly logger = new Logger(SupabaseGameHistoryRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async create(entry: CreateGameHistoryEntry): Promise<GameHistoryEntry> {
    const gameStateId =
      entry.gameStateId ?? (await this.findGameStateIdByRoomId(entry.roomId));

    if (!gameStateId) {
      throw new Error(`Game state not found for room ${entry.roomId}`);
    }

    const requestedActorId = entry.actorSeatId ?? null;
    if (requestedActorId && !this.isUuid(requestedActorId)) {
      throw new Error(
        `Game history actor must be a canonical seat UUID: ${requestedActorId}`,
      );
    }
    const actorSeatId = requestedActorId;

    const { data, error } = await this.supabase
      .from('game_history')
      .insert({
        room_id: entry.roomId,
        game_state_id: gameStateId,
        action_type: entry.actionType,
        actor_seat_id: actorSeatId,
        actor_key_snapshot: null,
        action_data: toJsonObject(entry.actionData ?? {}),
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to insert game history entry', error);
      throw new Error(`Failed to insert game history entry: ${error.message}`);
    }

    return this.mapRow(data);
  }

  async findByRoomId(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistoryEntry[]> {
    let request = this.supabase
      .from('game_history')
      .select('*')
      .eq('room_id', roomId);

    if (query?.actionType) {
      request = request.eq('action_type', query.actionType);
    }

    if (query?.actorSeatId) {
      request = request.eq('actor_seat_id', query.actorSeatId);
    }

    if (query?.since) {
      request = request.gte('timestamp', query.since.toISOString());
    }

    if (query?.until) {
      request = request.lte('timestamp', query.until.toISOString());
    }

    request = request.order('timestamp', { ascending: true });

    if (typeof query?.limit === 'number' && query.limit > 0) {
      request = request.limit(query.limit);
    }

    const { data, error } = await request;

    if (error) {
      this.logger.error('Failed to list game history entries', error);
      throw new Error(`Failed to list game history entries: ${error.message}`);
    }

    const entries = (data ?? []).map((row) => this.mapRow(row));

    if (typeof query?.roundNumber !== 'number') {
      return entries;
    }

    return entries.filter(
      (entry) => this.extractRoundNumber(entry) === query.roundNumber,
    );
  }

  async deleteForFinishedRoomsOutsideRecentLimit(
    limit: number,
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('rooms')
      .select('id')
      .eq('status', 'finished')
      .order('last_activity_at', { ascending: false });

    if (error) {
      this.logger.error(
        'Failed to list finished rooms for history pruning',
        error,
      );
      throw new Error(
        `Failed to list finished rooms for history pruning: ${error.message}`,
      );
    }

    const roomIds = (data ?? []).map((room) => room.id);
    const staleRoomIds = roomIds.slice(Math.max(1, limit));
    let deletedCount = 0;

    for (let index = 0; index < staleRoomIds.length; index += 100) {
      const roomIdChunk = staleRoomIds.slice(index, index + 100);
      if (roomIdChunk.length === 0) {
        continue;
      }

      const { count, error: deleteError } = await this.supabase
        .from('game_history')
        .delete({ count: 'exact' })
        .in('room_id', roomIdChunk);

      if (deleteError) {
        this.logger.error(
          'Failed to prune old game history entries',
          deleteError,
        );
        throw new Error(
          `Failed to prune old game history entries: ${deleteError.message}`,
        );
      }

      deletedCount += count ?? 0;
    }

    return deletedCount;
  }

  private async findGameStateIdByRoomId(
    roomId: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('game_states')
      .select('id')
      .eq('room_id', roomId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }

      this.logger.error(
        'Failed to resolve game_state_id for game history',
        error,
      );
      throw new Error(`Failed to resolve game_state_id: ${error.message}`);
    }

    return data?.id ?? null;
  }

  private mapRow(row: GameHistoryRow): GameHistoryEntry {
    if (
      !row.room_id ||
      !row.game_state_id ||
      !row.timestamp ||
      !this.isRecord(row.action_data)
    ) {
      throw new Error(`Game history row ${row.id} is missing required data`);
    }
    return {
      id: row.id,
      roomId: row.room_id,
      gameStateId: row.game_state_id,
      actionType: row.action_type as GameHistoryActionType,
      actorSeatId: row.actor_seat_id ? asSeatId(row.actor_seat_id) : null,
      actorKeySnapshot: row.actor_key_snapshot,
      actionData: row.action_data ?? {},
      timestamp: new Date(row.timestamp),
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private extractRoundNumber(entry: GameHistoryEntry): number | null {
    const context =
      entry.actionData?.context &&
      typeof entry.actionData.context === 'object' &&
      entry.actionData.context !== null
        ? (entry.actionData.context as { roundNumber?: unknown })
        : null;

    return typeof context?.roundNumber === 'number'
      ? context.roundNumber
      : null;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
  }
}
