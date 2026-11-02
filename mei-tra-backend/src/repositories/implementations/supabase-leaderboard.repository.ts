import { Injectable } from '@nestjs/common';
import type {
  LeaderboardMode,
  LeaderboardResponse,
} from '@contracts/leaderboard';
import { SupabaseService } from '../../database/supabase.service';
import { toJson } from '../../database/json-value';
import {
  ILeaderboardRepository,
  RankedPlayerResult,
} from '../interfaces/leaderboard.repository.interface';

@Injectable()
export class SupabaseLeaderboardRepository implements ILeaderboardRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async record(
    matchId: string,
    mode: LeaderboardMode,
    players: RankedPlayerResult[],
  ): Promise<void> {
    const { error } = await this.supabaseService.client.rpc(
      'record_ranked_match',
      {
        p_match_id: matchId,
        p_mode: mode,
        p_players: toJson(
          players.map((player) => ({
            user_id: player.userId,
            won: player.won,
          })),
        ),
      },
    );
    if (error)
      throw new Error(`Failed to record ranked match: ${error.message}`);
  }

  async get(
    mode: LeaderboardMode,
    viewerId: string,
  ): Promise<LeaderboardResponse> {
    const { data, error } = await this.supabaseService.client.rpc(
      'get_win_rate_leaderboard',
      {
        p_mode: mode,
        p_viewer_id: viewerId,
      },
    );
    if (error) throw new Error(`Failed to fetch leaderboard: ${error.message}`);
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      !Array.isArray(data.entries) ||
      !('me' in data)
    ) {
      throw new Error('Invalid leaderboard response');
    }
    const result = data as unknown as Pick<
      LeaderboardResponse,
      'entries' | 'me'
    >;
    return { mode, minimumGames: 10, entries: result.entries, me: result.me };
  }
}
