import { useEffect, useState } from 'react';
import type { LeaderboardResponse } from '@meitra/contracts/leaderboard';
import type { GameMode } from '@meitra/contracts/room';
import { loadLeaderboard } from '@meitra/api-client/leaderboard';
import { leaderboardApi } from '@/lib/leaderboard-api';

interface LeaderboardState {
  leaderboard: LeaderboardResponse | null;
  isLoading: boolean;
  hasError: boolean;
}

export function useLeaderboard(
  mode: GameMode,
  userId: string | undefined,
  getAccessToken: () => Promise<string | null>,
): LeaderboardState {
  const [state, setState] = useState<LeaderboardState>({
    leaderboard: null,
    isLoading: true,
    hasError: false,
  });

  useEffect(() => {
    if (!userId) return;
    setState({ leaderboard: null, isLoading: true, hasError: false });
    return loadLeaderboard({
      client: leaderboardApi,
      mode,
      getAccessToken,
      onLoaded: (leaderboard) => setState({ leaderboard, isLoading: false, hasError: false }),
      onFailed: () => setState({ leaderboard: null, isLoading: false, hasError: true }),
    });
  }, [getAccessToken, mode, userId]);

  return state;
}
