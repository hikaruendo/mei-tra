import { SupabaseService } from '../../database/supabase.service';
import { SupabaseLeaderboardRepository } from './supabase-leaderboard.repository';

describe('SupabaseLeaderboardRepository', () => {
  it('sends the database field names expected by the atomic match writer', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    const repository = new SupabaseLeaderboardRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await repository.record('match-id', 'normal', [
      { userId: 'user-1', won: true },
      { userId: 'user-2', won: false },
    ]);

    expect(rpc).toHaveBeenCalledWith('record_ranked_match', {
      p_match_id: 'match-id',
      p_mode: 'normal',
      p_players: [
        { user_id: 'user-1', won: true },
        { user_id: 'user-2', won: false },
      ],
    });
  });
});
