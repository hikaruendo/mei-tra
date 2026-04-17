/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IGameHistoryRepository } from '../interfaces/game-history.repository.interface';
import {
  CreateGameHistoryEntry,
  GameHistoryActionType,
  GameHistoryEntry,
  GameHistoryQuery,
} from '../../types/game-history.types';
import { Database } from '../../types/database.types';

type GameHistoryRow = Database['public']['Tables']['game_history']['Row'];
type GameStateIdRow = Pick<
  Database['public']['Tables']['game_states']['Row'],
  'id'
>;

@Injectable()
export class SupabaseGameHistoryRepository implements IGameHistoryRepository {
  private readonly logger = new Logger(SupabaseGameHistoryRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client as any;
  }

  async create(entry: CreateGameHistoryEntry): Promise<GameHistoryEntry> {
    const gameStateId =
      entry.gameStateId ?? (await this.findGameStateIdByRoomId(entry.roomId));

    if (!gameStateId) {
      throw new Error(`Game state not found for room ${entry.roomId}`);
    }

    const { data, error } = await this.supabase
      .from('game_history')
      .insert({
        room_id: entry.roomId,
        game_state_id: gameStateId,
        action_type: entry.actionType,
        player_id: entry.playerId ?? null,
        action_data: entry.actionData ?? {},
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to insert game history entry', error);
      throw new Error(`Failed to insert game history entry: ${error.message}`);
    }

    return this.mapRow(data as GameHistoryRow);
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

    if (query?.playerId) {
      request = request.eq('player_id', query.playerId);
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

    const entries = ((data as GameHistoryRow[]) ?? []).map((row) =>
      this.mapRow(row),
    );

    if (typeof query?.roundNumber !== 'number') {
      return entries;
    }

    return entries.filter(
      (entry) => this.extractRoundNumber(entry) === query.roundNumber,
    );
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

    return (data as GameStateIdRow | null)?.id ?? null;
  }

  private mapRow(row: GameHistoryRow): GameHistoryEntry {
    return {
      id: row.id,
      roomId: row.room_id,
      gameStateId: row.game_state_id,
      actionType: row.action_type as GameHistoryActionType,
      playerId: row.player_id,
      actionData: row.action_data ?? {},
      timestamp: new Date(row.timestamp),
    };
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
}
