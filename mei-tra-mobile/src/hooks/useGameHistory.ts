import type {
  GameHistoryReplayViewContract,
  GameHistorySummaryContract,
} from '@meitra/contracts/game-history';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  fetchGameHistoryReplay,
  fetchGameHistorySummary,
} from '@/lib/game-history-api';

interface UseGameHistoryResult {
  replay: GameHistoryReplayViewContract | null;
  summary: GameHistorySummaryContract | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useGameHistory(
  roomId: string | null,
  enabled = true,
): UseGameHistoryResult {
  const { getAccessToken } = useAuth();
  const [replay, setReplay] =
    useState<GameHistoryReplayViewContract | null>(null);
  const [summary, setSummary] =
    useState<GameHistorySummaryContract | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!roomId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const [replayData, summaryData] = await Promise.all([
        fetchGameHistoryReplay(roomId, token),
        fetchGameHistorySummary(roomId, token),
      ]);
      setReplay(replayData);
      setSummary(summaryData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'ゲーム履歴の取得に失敗しました',
      );
    } finally {
      setLoading(false);
    }
  }, [roomId, enabled, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return { replay, summary, loading, error, refresh: load };
}
