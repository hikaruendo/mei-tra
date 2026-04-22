'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchProfileGameHistory } from '@/lib/api/profile-game-history';
import { RecentGameHistoryItem } from '@/types/game-history.types';

export function useProfileGameHistory(
  userId: string | null,
  enabled: boolean,
  getAccessToken: () => Promise<string | null>,
) {
  const [items, setItems] = useState<RecentGameHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      const nextItems = await fetchProfileGameHistory(userId, accessToken);
      setItems(nextItems);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to fetch recent game history',
      );
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, userId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void refresh();
  }, [enabled, refresh]);

  return {
    items,
    isLoading,
    error,
    refresh,
  };
}
