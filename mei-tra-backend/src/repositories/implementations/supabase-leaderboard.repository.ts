import { Injectable } from '@nestjs/common';
import { toWinRateLeaderboard } from '../../adapters/leaderboard-adapters';
import { SupabaseService } from '../../database/supabase.service';
import type { WinRateLeaderboard } from '../../types/leaderboard.types';
import type { GameMode } from '../../types/room.types';
import { ILeaderboardRepository } from '../interfaces/leaderboard.repository.interface';

@Injectable()
export class SupabaseLeaderboardRepository implements ILeaderboardRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getWinRateLeaderboard(
    mode: GameMode,
    viewerId: string,
  ): Promise<WinRateLeaderboard> {
    const { data, error } = await this.supabaseService.client.rpc(
      'get_win_rate_leaderboard',
      {
        p_mode: mode,
        p_viewer_id: viewerId,
      },
    );
    if (error) throw new Error(`Failed to fetch leaderboard: ${error.message}`);
    return toWinRateLeaderboard(data);
  }
}
