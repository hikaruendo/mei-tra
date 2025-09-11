/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IGameStateRepository } from '../interfaces/game-state.repository.interface';
import { GameState, Player, ScoreRecord } from '../../types/game.types';
import { Database } from '../../types/database.types';

type GameStateRow = Database['public']['Tables']['game_states']['Row'];
type GameStateUpdate = Database['public']['Tables']['game_states']['Update'];

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
            players: gameState.players,
            deck: gameState.deck,
            agari: gameState.agari,
            blowState: gameState.blowState,
            playState: gameState.playState,
          },
          current_player_index: gameState.currentPlayerIndex,
          game_phase: gameState.gamePhase,
          round_number: gameState.roundNumber,
          points_to_win: gameState.pointsToWin,
          team_scores: gameState.teamScores,
          team_score_records: gameState.teamScoreRecords,
          team_assignments: gameState.teamAssignments,
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create game state:', error);
        throw new Error(`Failed to create game state: ${error.message}`);
      }

      return this.mapDatabaseToGameState(data);
    } catch (error) {
      this.logger.error('Error creating game state:', error);
      throw error;
    }
  }

  async findByRoomId(roomId: string): Promise<GameState | null> {
    try {
      const { data, error } = await this.supabase
        .from('game_states')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Game state not found
        }
        throw new Error(`Failed to fetch game state: ${error.message}`);
      }

      return this.mapDatabaseToGameState(data);
    } catch (error) {
      this.logger.error('Error finding game state by room ID:', error);
      throw error;
    }
  }

  async update(
    roomId: string,
    gameState: Partial<GameState>,
  ): Promise<GameState | null> {
    try {
      const updateData: Partial<GameStateUpdate> = {};

      if (
        gameState.players ||
        gameState.deck ||
        gameState.agari ||
        gameState.blowState ||
        gameState.playState
      ) {
        // Get current state data first
        const { data: currentData } = await this.supabase
          .from('game_states')
          .select('state_data')
          .eq('room_id', roomId)
          .single();

        const currentStateData =
          (currentData?.state_data as Record<string, any>) || {};

        updateData.state_data = {
          ...currentStateData,
          ...(gameState.players && { players: gameState.players }),
          ...(gameState.deck && { deck: gameState.deck }),
          ...(gameState.agari !== undefined && { agari: gameState.agari }),
          ...(gameState.blowState && { blowState: gameState.blowState }),
          ...(gameState.playState && { playState: gameState.playState }),
        };
      }

      if (gameState.currentPlayerIndex !== undefined)
        updateData.current_player_index = gameState.currentPlayerIndex;
      if (gameState.gamePhase !== undefined)
        updateData.game_phase = gameState.gamePhase;
      if (gameState.roundNumber !== undefined)
        updateData.round_number = gameState.roundNumber;
      if (gameState.pointsToWin !== undefined)
        updateData.points_to_win = gameState.pointsToWin;
      if (gameState.teamScores) updateData.team_scores = gameState.teamScores;
      if (gameState.teamScoreRecords) {
        // Convert Date objects to strings for database storage
        const convertedRecords: Record<
          string,
          Array<{ points: number; timestamp: string; reason: string }>
        > = {};
        Object.entries(gameState.teamScoreRecords).forEach(
          ([team, records]) => {
            convertedRecords[team] = records.map((record) => ({
              points: record.points,
              timestamp: record.timestamp.toISOString(),
              reason: record.reason,
            }));
          },
        );
        updateData.team_score_records = convertedRecords;
      }
      if (gameState.teamAssignments)
        updateData.team_assignments = gameState.teamAssignments;

      const { data, error } = await this.supabase
        .from('game_states')
        .update(updateData)
        .eq('room_id', roomId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update game state: ${error.message}`);
      }

      return this.mapDatabaseToGameState(data);
    } catch (error) {
      this.logger.error('Error updating game state:', error);
      throw error;
    }
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

  async updatePlayers(roomId: string, players: Player[]): Promise<boolean> {
    try {
      const { data: currentData } = await this.supabase
        .from('game_states')
        .select('state_data')
        .eq('room_id', roomId)
        .single();

      const currentStateData =
        (currentData?.state_data as Record<string, any>) || {};

      const { error } = await this.supabase
        .from('game_states')
        .update({
          state_data: {
            ...currentStateData,
            players,
          },
        })
        .eq('room_id', roomId);

      if (error) {
        this.logger.error('Failed to update players:', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error updating players:', error);
      return false;
    }
  }

  async updatePlayer(
    roomId: string,
    playerId: string,
    updates: Partial<Player>,
  ): Promise<boolean> {
    try {
      const { data: currentData } = await this.supabase
        .from('game_states')
        .select('state_data')
        .eq('room_id', roomId)
        .single();

      const currentStateData =
        (currentData?.state_data as Record<string, any>) || {};
      const players = (currentStateData.players as Player[]) || [];

      const playerIndex = players.findIndex(
        (p: Player) => p.playerId === playerId,
      );
      if (playerIndex === -1) {
        this.logger.warn(`Player ${playerId} not found in game state`);
        return false;
      }

      players[playerIndex] = { ...players[playerIndex], ...updates };

      const { error } = await this.supabase
        .from('game_states')
        .update({
          state_data: {
            ...currentStateData,
            players,
          },
        })
        .eq('room_id', roomId);

      if (error) {
        this.logger.error('Failed to update player:', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error updating player:', error);
      return false;
    }
  }

  async updateGamePhase(roomId: string, phase: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('game_states')
        .update({
          game_phase:
            phase as Database['public']['Tables']['game_states']['Row']['game_phase'],
        })
        .eq('room_id', roomId);

      if (error) {
        this.logger.error('Failed to update game phase:', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error updating game phase:', error);
      return false;
    }
  }

  async updateCurrentPlayerIndex(
    roomId: string,
    index: number,
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('game_states')
        .update({ current_player_index: index })
        .eq('room_id', roomId);

      if (error) {
        this.logger.error('Failed to update current player index:', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error updating current player index:', error);
      return false;
    }
  }

  async bulkUpdate(
    roomId: string,
    updates: Partial<GameStateUpdate>,
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('game_states')
        .update(updates)
        .eq('room_id', roomId);

      if (error) {
        this.logger.error('Failed to bulk update game state:', error);
        return false;
      }

      return true;
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

  private mapDatabaseToGameState(dbGameState: GameStateRow): GameState {
    const stateData = dbGameState.state_data || {};

    return {
      players: stateData.players || [],
      currentPlayerIndex: dbGameState.current_player_index,
      gamePhase: dbGameState.game_phase,
      deck: stateData.deck || [],
      teamScores: dbGameState.team_scores as Record<
        0 | 1,
        { play: number; total: number }
      >,
      teamScoreRecords: this.convertTimestampRecords(
        dbGameState.team_score_records,
      ),
      blowState: stateData.blowState,
      playState: stateData.playState,
      agari: stateData.agari,
      roundNumber: dbGameState.round_number,
      pointsToWin: dbGameState.points_to_win,
      teamAssignments: dbGameState.team_assignments as {
        [playerId: string]: 0 | 1;
      },
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
