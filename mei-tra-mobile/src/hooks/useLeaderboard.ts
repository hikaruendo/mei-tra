import { useEffect, useState } from 'react';
import type { LeaderboardMode, LeaderboardResponse } from '@meitra/contracts/leaderboard';
import { leaderboardApi } from '@/lib/leaderboard-api';

export function useLeaderboard(
  mode: LeaderboardMode,
  userId: string | undefined,
  getAccessToken: () => Promise<string | null>,
) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setIsLoading(true);
    setHasError(false);
    setLeaderboard(null);
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('No session');
        const result = await leaderboardApi.fetchLeaderboard(mode, token, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setLeaderboard(result);
      } catch {
        if (!controller.signal.aborted) setHasError(true);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [getAccessToken, mode, userId]);

  return { leaderboard, isLoading, hasError };
}
