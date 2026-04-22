'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchGameHistoryReplay,
  fetchGameHistorySummary,
} from '@/lib/api/game-history';
import {
  GameHistoryReplayQuery,
  GameHistorySummary,
  GameHistoryReplayView,
} from '@/types/game-history.types';
import { useAuth } from '@/hooks/useAuth';

export function useGameHistory(
  roomId: string | null,
  enabled: boolean,
  options?: {
    replayQuery?: GameHistoryReplayQuery;
    summaryQuery?: GameHistoryReplayQuery;
    includeReplay?: boolean;
    includeSummary?: boolean;
  },
) {
  const [replay, setReplay] = useState<GameHistoryReplayView | null>(null);
  const [summary, setSummary] = useState<GameHistorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getAccessToken } = useAuth();

  const loadHistory = useCallback(async () => {
    if (!roomId) {
      setReplay(null);
      setSummary(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      const includeReplay = options?.includeReplay ?? true;
      const includeSummary = options?.includeSummary ?? true;
      const [nextReplay, nextSummary] = await Promise.all([
        includeReplay
          ? fetchGameHistoryReplay(roomId, accessToken, options?.replayQuery)
          : Promise.resolve(null),
        includeSummary
          ? fetchGameHistorySummary(roomId, accessToken, options?.summaryQuery)
          : Promise.resolve(null),
      ]);
      setReplay(nextReplay);
      setSummary(nextSummary);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to fetch game history',
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    options?.includeReplay,
    options?.includeSummary,
    options?.replayQuery,
    options?.summaryQuery,
    getAccessToken,
    roomId,
  ]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void loadHistory();
  }, [enabled, loadHistory]);

  return {
    replay,
    summary,
    isLoading,
    error,
    refresh: loadHistory,
  };
}
