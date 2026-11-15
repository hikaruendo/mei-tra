import { Injectable } from '@nestjs/common';
import type {
  LeaderboardMode,
  LeaderboardResponse,
} from '@contracts/leaderboard';
import { toLeaderboardResponse } from '../../adapters/leaderboard-adapters';
import { SupabaseService } from '../../database/supabase.service';
import { ILeaderboardRepository } from '../interfaces/leaderboard.repository.interface';

@Injectable()
export class SupabaseLeaderboardRepository implements ILeaderboardRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getWinRateLeaderboard(
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
    return toLeaderboardResponse(mode, data);
  }
}
